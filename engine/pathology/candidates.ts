import { echoHold, slicePixel } from '@/engine/temporal/hold'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { ArtifactNote, CandidateKind, LesionCandidate } from '@/types/pathology'
import type { ConfidenceParts } from '@/types/provenance'

export interface SliceDepth {
  id: string
  depth: number
  timestamp?: number
  gray?: Float32Array
  width?: number
  height?: number
  probeX?: number
  probeY?: number
}

export interface CandidateScan {
  status: 'OK' | 'INSUFFICIENT DATA'
  candidates: LesionCandidate[]
  artifacts: ArtifactNote[]
}

interface Blob {
  kind: CandidateKind
  cells: number[]
}

export function scanCandidates(volume: ReconstructedVolume, slices: readonly SliceDepth[], now = 0): CandidateScan {
  const observed = observedIndexes(volume)
  if (observed.length < 12 || volume.size[0] === 0) {
    return { status: 'INSUFFICIENT DATA', candidates: [], artifacts: [] }
  }
  let sum = 0
  for (const index of observed) sum += volume.scalars[index] ?? 0
  const mean = sum / observed.length
  const dark: number[] = []
  const bright: number[] = []
  for (const index of observed) {
    const value = volume.scalars[index] ?? 0
    if (value < Math.min(0.22, mean * 0.55)) dark.push(index)
    if (value > Math.max(0.72, mean + 0.28)) bright.push(index)
  }
  const blobs = [
    ...components(volume, dark, 'hypoechoic'),
    ...components(volume, bright, 'hyperechoic'),
  ]
  const artifacts: ArtifactNote[] = []
  const candidates: LesionCandidate[] = []
  const limit = Math.max(12, Math.floor(observed.length * 0.25))
  for (const blob of blobs) {
    if (blob.cells.length < 12 || blob.cells.length > limit) continue
    if (borderFraction(volume, blob.cells) > 0.45) {
      artifacts.push({
        id: `artifact-${artifacts.length + 1}`,
        label: blob.kind === 'hypoechoic' ? 'тёмная зона у края, похоже на тень или обрез' : 'яркая зона у края',
        voxelCount: blob.cells.length,
      })
      continue
    }
    const center = centroid(volume, blob.cells)
    const extent = blobExtent(volume, blob.cells)
    const frames = framesNear(slices, volume, center.z)
    const span = zSpan(volume, blob.cells)
    const confidence = scores(volume, blob.cells, mean, span)
    candidates.push({
      id: `candidate-${candidates.length + 1}`,
      kind: blob.kind,
      location: center,
      extent,
      voxelCount: blob.cells.length,
      echogenicity: blob.kind === 'hypoechoic' ? 'ниже окружения' : 'выше окружения',
      hold: echoHold(
        blob.kind,
        ...holdPoint(volume, center.x, center.y, slices),
        slices.flatMap((slice) => (slice.gray && slice.width && slice.height ? [{ id: slice.id, gray: slice.gray, width: slice.width, height: slice.height }] : [])),
        frames,
        new Map(slices.map((slice) => [slice.id, { x: slice.probeX ?? 0, y: slice.probeY ?? 0 }])),
      ),
      provenance: {
        source: 'US_RECONSTRUCTED',
        frames,
        coordinates: center,
        confidence,
        spatialConsistency: confidence.spatial,
        temporalConsistency: confidence.temporal,
        model: 'threshold-component',
        timestamp: slices.find((slice) => slice.id === frames[0])?.timestamp ?? now,
      },
    })
  }
  return {
    status: candidates.length === 0 && artifacts.length === 0 && observed.length < 30 ? 'INSUFFICIENT DATA' : 'OK',
    candidates: candidates.slice(0, 6),
    artifacts,
  }
}

function scores(volume: ReconstructedVolume, cells: number[], mean: number, span: number): ConfidenceParts {
  let local = 0
  for (const index of cells) local += volume.scalars[index] ?? 0
  const visual = Math.max(0, Math.min(1, Math.abs(local / cells.length - mean) * 2))
  const spatial = span >= 2 ? 0.55 : 0.28
  const temporal = span >= 2 ? 0.5 : 0.22
  const anatomical = 0.15
  const model = 0.35
  const overall = Math.min(0.74, visual * 0.4 + spatial * 0.25 + temporal * 0.15 + anatomical * 0.1 + model * 0.1)
  return { visual, spatial, temporal, anatomical, model, overall }
}

function observedIndexes(volume: ReconstructedVolume): number[] {
  const indexes: number[] = []
  for (let index = 0; index < volume.observed.length; index += 1) {
    if (volume.observed[index] === 1) indexes.push(index)
  }
  return indexes
}

function components(volume: ReconstructedVolume, seeds: number[], kind: CandidateKind): Blob[] {
  const [sx, sy] = volume.size
  const member = new Set(seeds)
  const seen = new Set<number>()
  const blobs: Blob[] = []
  for (const seed of seeds) {
    if (seen.has(seed)) continue
    const cells: number[] = []
    const queue = [seed]
    seen.add(seed)
    while (queue.length > 0 && cells.length < 8000) {
      const current = queue.pop()
      if (current == null) break
      cells.push(current)
      const x = current % sx
      const y = Math.floor(current / sx) % sy
      const z = Math.floor(current / (sx * sy))
      const neighbors = [
        [x - 1, y, z],
        [x + 1, y, z],
        [x, y - 1, z],
        [x, y + 1, z],
        [x, y, z - 1],
        [x, y, z + 1],
      ]
      for (const [nx, ny, nz] of neighbors) {
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= volume.size[2]) continue
        const next = voxelIndex(volume.size, nx, ny, nz)
        if (!member.has(next) || seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    blobs.push({ kind, cells })
  }
  return blobs
}

function borderFraction(volume: ReconstructedVolume, cells: number[]): number {
  const [sx, sy, sz] = volume.size
  let edge = 0
  for (const index of cells) {
    const x = index % sx
    const y = Math.floor(index / sx) % sy
    const z = Math.floor(index / (sx * sy))
    if (x === 0 || y === 0 || z === 0 || x === sx - 1 || y === sy - 1 || z === sz - 1) edge += 1
  }
  return cells.length === 0 ? 1 : edge / cells.length
}

function centroid(volume: ReconstructedVolume, cells: number[]): { x: number; y: number; z: number } {
  const [sx, sy] = volume.size
  let x = 0
  let y = 0
  let z = 0
  for (const index of cells) {
    x += index % sx
    y += Math.floor(index / sx) % sy
    z += Math.floor(index / (sx * sy))
  }
  const count = cells.length || 1
  return {
    x: Math.round((x / count) * 10) / 10,
    y: Math.round((y / count) * 10) / 10,
    z: Math.round((z / count) * 10) / 10,
  }
}

function blobExtent(volume: ReconstructedVolume, cells: number[]): { x: number; y: number; z: number } {
  const [sx, sy] = volume.size
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const index of cells) {
    const x = index % sx
    const y = Math.floor(index / sx) % sy
    const z = Math.floor(index / (sx * sy))
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }
  return { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 }
}

function zSpan(volume: ReconstructedVolume, cells: number[]): number {
  const [sx, sy] = volume.size
  let min = Infinity
  let max = -Infinity
  for (const index of cells) {
    const z = Math.floor(index / (sx * sy))
    min = Math.min(min, z)
    max = Math.max(max, z)
  }
  return max - min + 1
}

function holdPoint(volume: ReconstructedVolume, x: number, y: number, slices: readonly SliceDepth[]): [number, number] {
  const slice = slices.find((item) => item.width && item.height)
  if (!slice?.width || !slice.height) return [x, y]
  const pixel = slicePixel(volume.originMm[0], volume.originMm[1], volume.spacingMm[0], volume.spacingMm[1], x, y, slice.width, slice.height)
  return [pixel.x, pixel.y]
}

function framesNear(slices: readonly SliceDepth[], volume: ReconstructedVolume, zIndex: number): string[] {
  if (slices.length === 0) return []
  const world = volume.originMm[2] + zIndex * (volume.spacingMm[2] || 1)
  const ranked = [...slices].sort((left, right) => Math.abs(left.depth - world) - Math.abs(right.depth - world))
  return ranked.slice(0, 3).map((slice) => slice.id)
}
