import { relativePose } from '@/lib/volume-engine/core/TransformValidation'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import type { PoseEstimate } from '@/lib/volume-engine/pose/PoseProvider'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import type { Phantom } from '@/benchmark/freehand3d/phantoms/types'
import type { SweepFrame } from '@/benchmark/freehand3d/phantoms/sweep'

export type MetricValue = number | 'NOT IMPLEMENTED' | 'NOT AVAILABLE' | 'NOT ESTIMATED'

const NEIGHBORS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

export function voxelCenter(volume: ReconstructedVolume, x: number, y: number, z: number): Vec3 {
  return [
    volume.originMm[0] + x * volume.spacingMm[0],
    volume.originMm[1] + y * volume.spacingMm[1],
    volume.originMm[2] + z * volume.spacingMm[2],
  ]
}

function distance(left: Vec3, right: Vec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function maxOf(values: readonly number[]): number {
  let best = 0
  for (const value of values) if (value > best) best = value
  return best
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index] ?? 0
}

export function observedCenters(volume: ReconstructedVolume): Vec3[] {
  const points: Vec3[] = []
  const [sx, sy, sz] = volume.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (volume.observed[voxelIndex(volume.size, x, y, z)] !== 1) continue
        points.push(voxelCenter(volume, x, y, z))
      }
    }
  }
  return points
}

export function centroidOf(points: readonly Vec3[]): Vec3 | null {
  if (points.length === 0) return null
  const sum = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0])
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

export interface SurfaceDistances {
  meanMm: number
  p95Mm: number
  hausdorffMm: number
}

export function phantomSurface(phantom: Phantom, spacingMm = 1): Vec3[] {
  const min: Vec3 = [
    phantom.truth.bounds.min[0] - spacingMm,
    phantom.truth.bounds.min[1] - spacingMm,
    phantom.truth.bounds.min[2] - spacingMm,
  ]
  const max: Vec3 = [
    phantom.truth.bounds.max[0] + spacingMm,
    phantom.truth.bounds.max[1] + spacingMm,
    phantom.truth.bounds.max[2] + spacingMm,
  ]
  const size: [number, number, number] = [
    Math.floor((max[0] - min[0]) / spacingMm) + 1,
    Math.floor((max[1] - min[1]) / spacingMm) + 1,
    Math.floor((max[2] - min[2]) / spacingMm) + 1,
  ]
  const inside = (x: number, y: number, z: number) => phantom.contains([
    min[0] + x * spacingMm,
    min[1] + y * spacingMm,
    min[2] + z * spacingMm,
  ])
  const points: Vec3[] = []
  for (let z = 0; z < size[2]; z += 1) {
    for (let y = 0; y < size[1]; y += 1) {
      for (let x = 0; x < size[0]; x += 1) {
        if (!inside(x, y, z)) continue
        const exposed = NEIGHBORS.some(([dx, dy, dz]) => {
          const nx = x + dx
          const ny = y + dy
          const nz = z + dz
          if (nx < 0 || ny < 0 || nz < 0 || nx >= size[0] || ny >= size[1] || nz >= size[2]) return true
          return !inside(nx, ny, nz)
        })
        if (!exposed) continue
        points.push([min[0] + x * spacingMm, min[1] + y * spacingMm, min[2] + z * spacingMm])
      }
    }
  }
  return points
}

export function reconstructionSurface(volume: ReconstructedVolume): Vec3[] {
  const [sx, sy, sz] = volume.size
  const points: Vec3[] = []
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const index = voxelIndex(volume.size, x, y, z)
        if (volume.observed[index] !== 1) continue
        const exposed = NEIGHBORS.some(([dx, dy, dz]) => {
          const nx = x + dx
          const ny = y + dy
          const nz = z + dz
          if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) return true
          return volume.observed[voxelIndex(volume.size, nx, ny, nz)] !== 1
        })
        if (exposed) points.push(voxelCenter(volume, x, y, z))
      }
    }
  }
  return points
}

function directed(from: readonly Vec3[], to: readonly Vec3[]): number[] | null {
  if (from.length === 0 || to.length === 0) return null
  return from.map((point) => {
    let best = Number.POSITIVE_INFINITY
    for (const other of to) {
      const gap = distance(point, other)
      if (gap < best) best = gap
      if (best === 0) break
    }
    return best
  })
}

export function surfaceDistances(phantomPoints: readonly Vec3[], volume: ReconstructedVolume): SurfaceDistances | null {
  const reconstructed = reconstructionSurface(volume)
  const forward = directed(reconstructed, phantomPoints)
  const backward = directed(phantomPoints, reconstructed)
  if (!forward || !backward) return null
  return {
    meanMm: mean(forward),
    p95Mm: percentile(forward, 0.95),
    hausdorffMm: Math.max(maxOf(forward), maxOf(backward)),
  }
}

export function centroidErrorMm(volume: ReconstructedVolume, phantom: Phantom): MetricValue {
  const center = centroidOf(observedCenters(volume))
  if (!center) return 'NOT AVAILABLE'
  return distance(center, phantom.truth.centroid)
}

export function boundsErrorMm(volume: ReconstructedVolume, phantom: Phantom): MetricValue {
  const points = observedCenters(volume)
  if (points.length === 0) return 'NOT AVAILABLE'
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }
  let sum = 0
  for (let axis = 0; axis < 3; axis += 1) {
    sum += Math.abs(min[axis] - phantom.truth.bounds.min[axis])
    sum += Math.abs(max[axis] - phantom.truth.bounds.max[axis])
  }
  return sum / 6
}

export function extentsMm(volume: ReconstructedVolume): Vec3 | null {
  const points = observedCenters(volume)
  if (points.length === 0) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
}

export function dimensionErrorPercent(volume: ReconstructedVolume, phantom: Phantom): MetricValue {
  const extents = extentsMm(volume)
  if (!extents) return 'NOT AVAILABLE'
  let sum = 0
  for (let axis = 0; axis < 3; axis += 1) {
    const expected = phantom.truth.dimensionsMm[axis]
    if (expected == null || expected <= 0) return 'NOT AVAILABLE'
    sum += Math.abs(extents[axis] - expected) / expected
  }
  return (sum / 3) * 100
}

export function diameterError(volume: ReconstructedVolume, phantom: Phantom): { absoluteMm: MetricValue; percent: MetricValue; measuredMm: MetricValue } {
  const expected = phantom.truth.diameterMm
  const extents = extentsMm(volume)
  if (expected == null) return { absoluteMm: 'NOT AVAILABLE', percent: 'NOT AVAILABLE', measuredMm: 'NOT AVAILABLE' }
  if (!extents) return { absoluteMm: 'NOT AVAILABLE', percent: 'NOT AVAILABLE', measuredMm: 'NOT AVAILABLE' }
  const measured = phantom.truth.distanceBetweenStructuresMm != null ? extents[1] : (extents[0] + extents[1]) / 2
  const absolute = Math.abs(measured - expected)
  return { absoluteMm: absolute, percent: (absolute / expected) * 100, measuredMm: measured }
}

export function lengthError(volume: ReconstructedVolume, phantom: Phantom): { absoluteMm: MetricValue; percent: MetricValue; measuredMm: MetricValue } {
  const expected = phantom.truth.lengthMm
  const extents = extentsMm(volume)
  if (expected == null) return { absoluteMm: 'NOT AVAILABLE', percent: 'NOT AVAILABLE', measuredMm: 'NOT AVAILABLE' }
  if (!extents) return { absoluteMm: 'NOT AVAILABLE', percent: 'NOT AVAILABLE', measuredMm: 'NOT AVAILABLE' }
  const measured = extents[2]
  const absolute = Math.abs(measured - expected)
  return { absoluteMm: absolute, percent: (absolute / expected) * 100, measuredMm: measured }
}

export function separationOf(volume: ReconstructedVolume): number | null {
  const points = observedCenters(volume)
  if (points.length < 2) return null
  let minX = Infinity
  let maxX = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point[0])
    maxX = Math.max(maxX, point[0])
  }
  const mid = (minX + maxX) / 2
  const left = points.filter((point) => point[0] < mid)
  const right = points.filter((point) => point[0] >= mid)
  const leftCenter = centroidOf(left)
  const rightCenter = centroidOf(right)
  if (!leftCenter || !rightCenter) return null
  return distance(leftCenter, rightCenter)
}

export function separationErrorMm(volume: ReconstructedVolume, phantom: Phantom): MetricValue {
  const expected = phantom.truth.distanceBetweenStructuresMm
  if (expected == null) return 'NOT AVAILABLE'
  const measured = separationOf(volume)
  if (measured == null) return 'NOT AVAILABLE'
  return Math.abs(measured - expected)
}

export function volumeErrorPercent(volume: ReconstructedVolume, phantom: Phantom): MetricValue {
  const [sx, sy, sz] = volume.spacingMm
  if (sx <= 0 || sy <= 0 || sz <= 0 || phantom.truth.volumeMm3 <= 0) return 'NOT AVAILABLE'
  let count = 0
  for (const bit of volume.observed) if (bit === 1) count += 1
  if (count === 0) return 'NOT AVAILABLE'
  const reconstructed = count * sx * sy * sz
  return (Math.abs(reconstructed - phantom.truth.volumeMm3) / phantom.truth.volumeMm3) * 100
}

export interface PoseErrorReport {
  translationErrorXMm: MetricValue
  translationErrorYMm: MetricValue
  translationErrorZMm: MetricValue
  totalTranslationErrorMm: MetricValue
  rotation: MetricValue
  knownSteps: number
  unknownSteps: number
  rejectedSteps: number
}

function average(values: readonly number[], known: boolean): MetricValue {
  if (!known || values.length === 0) return 'NOT ESTIMATED'
  return mean(values)
}

export async function measurePose(frames: readonly SweepFrame[], provider = new RegistrationPoseProvider()): Promise<PoseErrorReport> {
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  const total: number[] = []
  const rotation: number[] = []
  let xKnown = false
  let yKnown = false
  let zKnown = false
  let rotationKnown = false
  let unknownSteps = 0
  let rejectedSteps = 0
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    if (!previous || !current) continue
    let estimate: PoseEstimate
    try {
      estimate = await provider.estimate(
        { gray: previous.image, width: previous.width, height: previous.height, pixelSpacingX: previous.pixelSpacingX, pixelSpacingY: previous.pixelSpacingY },
        { gray: current.image, width: current.width, height: current.height, pixelSpacingX: current.pixelSpacingX, pixelSpacingY: current.pixelSpacingY },
      )
    } catch (error) {
      if (error instanceof VolumeEngineError) {
        rejectedSteps += 1
        continue
      }
      throw error
    }
    const actual = relativePose(previous.groundTruthTransform, current.groundTruthTransform)
    const translationAxes = estimate.translationAxes ?? ['unknown', 'unknown', 'unknown']
    const rotationAxes = estimate.rotationAxes ?? ['unknown', 'unknown', 'unknown']
    if (translationAxes.every((axis) => axis === 'unknown')) unknownSteps += 1
    const parts: number[] = []
    if (translationAxes[0] === 'known') {
      xKnown = true
      const errorMm = Math.abs(estimate.translationMm[0] - actual.translationMm[0])
      x.push(errorMm)
      parts.push(errorMm)
    }
    if (translationAxes[1] === 'known') {
      yKnown = true
      const errorMm = Math.abs(estimate.translationMm[1] - actual.translationMm[1])
      y.push(errorMm)
      parts.push(errorMm)
    }
    if (translationAxes[2] === 'known') {
      zKnown = true
      const errorMm = Math.abs(estimate.translationMm[2] - actual.translationMm[2])
      z.push(errorMm)
      parts.push(errorMm)
    }
    if (parts.length > 0) total.push(Math.hypot(...parts))
    if (rotationAxes.some((axis) => axis === 'known')) {
      rotationKnown = true
      let sum = 0
      let count = 0
      for (let axis = 0; axis < 3; axis += 1) {
        if (rotationAxes[axis] !== 'known') continue
        sum += Math.abs((estimate.rotationRad[axis] ?? 0) - actual.rotationRad[axis])
        count += 1
      }
      if (count > 0) rotation.push((sum / count) * (180 / Math.PI))
    }
  }
  return {
    translationErrorXMm: average(x, xKnown),
    translationErrorYMm: average(y, yKnown),
    translationErrorZMm: average(z, zKnown),
    totalTranslationErrorMm: average(total, total.length > 0),
    rotation: average(rotation, rotationKnown),
    knownSteps: x.length,
    unknownSteps,
    rejectedSteps,
  }
}
