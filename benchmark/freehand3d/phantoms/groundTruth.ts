import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'
import { voxelCenter } from '@/benchmark/freehand3d/phantoms/metrics'
import type { Phantom, PhantomMeasurement } from '@/benchmark/freehand3d/phantoms/types'
import { occupancyAt } from '@/benchmark/freehand3d/phantoms/visualize'

export const DIFFERENCE_CODE = {
  match: 0.25,
  falseNegative: 0.75,
  falsePositive: 1,
} as const

const NEIGHBORS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

function emptyGrid(originMm: Vec3, spacingMm: number, size: [number, number, number]): ReconstructedVolume {
  const cells = size[0] * size[1] * size[2]
  return {
    originMm,
    spacingMm: [spacingMm, spacingMm, spacingMm],
    size,
    scalars: new Float32Array(cells),
    observed: new Uint8Array(cells),
    interpolated: new Uint8Array(cells),
    confidence: new Float32Array(cells),
    coverage: new Float32Array(cells),
    source: 'ultrasound',
    status: 'preview_only',
    poseMode: 'reference_test',
    clinicallyValidated: false,
  }
}

/** Сетка строится только из границ фантома и шага. Реконструкция в неё не входит. */
export function comparisonGrid(phantom: Phantom, spacingMm: number): ReconstructedVolume {
  const pad = spacingMm * 2
  const originMm: Vec3 = [
    phantom.truth.bounds.min[0] - pad,
    phantom.truth.bounds.min[1] - pad,
    phantom.truth.bounds.min[2] - pad,
  ]
  const max: Vec3 = [
    phantom.truth.bounds.max[0] + pad,
    phantom.truth.bounds.max[1] + pad,
    phantom.truth.bounds.max[2] + pad,
  ]
  const size: [number, number, number] = [
    Math.floor((max[0] - originMm[0]) / spacingMm) + 1,
    Math.floor((max[1] - originMm[1]) / spacingMm) + 1,
    Math.floor((max[2] - originMm[2]) / spacingMm) + 1,
  ]
  return emptyGrid(originMm, spacingMm, size)
}

export function voxelizePhantom(phantom: Phantom, template: ReconstructedVolume): ReconstructedVolume {
  const grid = emptyGrid(template.originMm, template.spacingMm[0], template.size)
  const [sx, sy, sz] = grid.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (!phantom.contains(voxelCenter(grid, x, y, z))) continue
        const index = voxelIndex(grid.size, x, y, z)
        grid.scalars[index] = 1
        grid.observed[index] = 1
        grid.coverage[index] = 1
      }
    }
  }
  return grid
}

export function projectReconstruction(volume: ReconstructedVolume, template: ReconstructedVolume): ReconstructedVolume {
  const grid = emptyGrid(template.originMm, template.spacingMm[0], template.size)
  const [sx, sy, sz] = grid.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (!occupancyAt(volume, voxelCenter(grid, x, y, z))) continue
        const index = voxelIndex(grid.size, x, y, z)
        grid.scalars[index] = 1
        grid.observed[index] = 1
        grid.coverage[index] = 1
      }
    }
  }
  return grid
}

export interface Overlap {
  truePositive: number
  falsePositive: number
  falseNegative: number
  dice: MetricValue
  iou: MetricValue
}

export function overlap(truth: Uint8Array, reconstruction: Uint8Array): Overlap {
  let truePositive = 0
  let falsePositive = 0
  let falseNegative = 0
  const length = Math.min(truth.length, reconstruction.length)
  for (let index = 0; index < length; index += 1) {
    const expected = truth[index] === 1
    const actual = reconstruction[index] === 1
    if (expected && actual) truePositive += 1
    else if (actual) falsePositive += 1
    else if (expected) falseNegative += 1
  }
  const diceDenom = 2 * truePositive + falsePositive + falseNegative
  const iouDenom = truePositive + falsePositive + falseNegative
  return {
    truePositive,
    falsePositive,
    falseNegative,
    dice: diceDenom === 0 ? 'NOT AVAILABLE' : (2 * truePositive) / diceDenom,
    iou: iouDenom === 0 ? 'NOT AVAILABLE' : truePositive / iouDenom,
  }
}

export function countOccupied(observed: Uint8Array): number {
  let count = 0
  for (const bit of observed) if (bit === 1) count += 1
  return count
}

export function volumeErrorVsVoxelTruthPercent(reconstruction: Uint8Array, truth: Uint8Array): MetricValue {
  const expected = countOccupied(truth)
  if (expected === 0) return 'NOT AVAILABLE'
  return (Math.abs(countOccupied(reconstruction) - expected) / expected) * 100
}

export function volumeErrorVsAnalyticTruthPercent(occupied: number, spacingMm: number, analyticMm3: number): MetricValue {
  if (analyticMm3 <= 0 || spacingMm <= 0) return 'NOT AVAILABLE'
  const reconstructed = occupied * spacingMm ** 3
  return (Math.abs(reconstructed - analyticMm3) / analyticMm3) * 100
}

function surfacePoints(volume: ReconstructedVolume): Vec3[] {
  const [sx, sy, sz] = volume.size
  const points: Vec3[] = []
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (volume.observed[voxelIndex(volume.size, x, y, z)] !== 1) continue
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

export interface DirectedSurface {
  meanMm: MetricValue
  p95Mm: MetricValue
  hausdorffMm: MetricValue
}

function summarize(values: number[] | null): DirectedSurface {
  if (!values || values.length === 0) return { meanMm: 'NOT AVAILABLE', p95Mm: 'NOT AVAILABLE', hausdorffMm: 'NOT AVAILABLE' }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1))
  let max = 0
  let sum = 0
  for (const value of values) {
    sum += value
    if (value > max) max = value
  }
  return { meanMm: sum / values.length, p95Mm: sorted[index] ?? 'NOT AVAILABLE', hausdorffMm: max }
}

function directed(from: readonly Vec3[], to: readonly Vec3[]): number[] | null {
  if (from.length === 0 || to.length === 0) return null
  return from.map((point) => {
    let best = Number.POSITIVE_INFINITY
    for (const other of to) {
      const gap = Math.hypot(point[0] - other[0], point[1] - other[1], point[2] - other[2])
      if (gap < best) best = gap
    }
    return best
  })
}

export interface DiscreteSurfaceDistance {
  method: 'discrete_surface_distance'
  reconstructionToGroundTruth: DirectedSurface
  groundTruthToReconstruction: DirectedSurface
}

export function discreteSurfaceDistance(truth: ReconstructedVolume, reconstruction: ReconstructedVolume): DiscreteSurfaceDistance {
  const truthSurface = surfacePoints(truth)
  const reconstructedSurface = surfacePoints(reconstruction)
  return {
    method: 'discrete_surface_distance',
    reconstructionToGroundTruth: summarize(directed(reconstructedSurface, truthSurface)),
    groundTruthToReconstruction: summarize(directed(truthSurface, reconstructedSurface)),
  }
}

export function differenceVolume(truth: ReconstructedVolume, reconstruction: ReconstructedVolume): ReconstructedVolume {
  const grid = emptyGrid(truth.originMm, truth.spacingMm[0], truth.size)
  const [sx, sy, sz] = grid.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const index = voxelIndex(grid.size, x, y, z)
        const expected = truth.observed[index] === 1
        const actual = reconstruction.observed[index] === 1
        if (!expected && !actual) continue
        grid.observed[index] = 1
        if (expected && actual) grid.scalars[index] = DIFFERENCE_CODE.match
        else if (actual) grid.scalars[index] = DIFFERENCE_CODE.falsePositive
        else grid.scalars[index] = DIFFERENCE_CODE.falseNegative
      }
    }
  }
  return grid
}

export function connectedComponents3D(volume: ReconstructedVolume): Vec3[][] {
  const [sx, sy, sz] = volume.size
  const seen = new Uint8Array(volume.observed.length)
  const components: Vec3[][] = []
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const start = voxelIndex(volume.size, x, y, z)
        if (volume.observed[start] !== 1 || seen[start] === 1) continue
        const component: Vec3[] = []
        const stack: Array<[number, number, number]> = [[x, y, z]]
        seen[start] = 1
        while (stack.length > 0) {
          const next = stack.pop()
          if (!next) break
          const [cx, cy, cz] = next
          component.push(voxelCenter(volume, cx, cy, cz))
          for (const [dx, dy, dz] of NEIGHBORS) {
            const nx = cx + dx
            const ny = cy + dy
            const nz = cz + dz
            if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue
            const index = voxelIndex(volume.size, nx, ny, nz)
            if (volume.observed[index] !== 1 || seen[index] === 1) continue
            seen[index] = 1
            stack.push([nx, ny, nz])
          }
        }
        components.push(component)
      }
    }
  }
  return components.sort((left, right) => right.length - left.length)
}

function centroid(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0])
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

export function componentSeparationMm(volume: ReconstructedVolume): MetricValue {
  const components = connectedComponents3D(volume).filter((component) => component.length >= 4)
  const first = components[0]
  const second = components[1]
  if (!first || !second) return 'NOT AVAILABLE'
  const left = centroid(first)
  const right = centroid(second)
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

export function axisExtentMm(volume: ReconstructedVolume, axis: 0 | 1 | 2): MetricValue {
  let min = Infinity
  let max = -Infinity
  let found = false
  const [sx, sy, sz] = volume.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (volume.observed[voxelIndex(volume.size, x, y, z)] !== 1) continue
        const center = voxelCenter(volume, x, y, z)
        found = true
        min = Math.min(min, center[axis])
        max = Math.max(max, center[axis])
      }
    }
  }
  if (!found) return 'NOT AVAILABLE'
  return max - min
}

export interface DeclaredMeasurement {
  name: PhantomMeasurement['name']
  expectedMm: number
  axis: PhantomMeasurement['axis']
  measuredMm: MetricValue
  errorMm: MetricValue
  method: 'axis-extent' | 'connected-components' | 'arc-not-an-axis-extent'
}

export function declaredMeasurements(phantom: Phantom, volume: ReconstructedVolume): DeclaredMeasurement[] {
  return phantom.truth.measurements.map((measurement) => {
    if (measurement.axis === 'arc') {
      return { ...measurement, measuredMm: 'NOT AVAILABLE', errorMm: 'NOT AVAILABLE', method: 'arc-not-an-axis-extent' as const }
    }
    if (measurement.axis === 'components') {
      const measured = componentSeparationMm(volume)
      return {
        ...measurement,
        measuredMm: measured,
        errorMm: typeof measured === 'number' ? Math.abs(measured - measurement.expectedMm) : measured,
        method: 'connected-components' as const,
      }
    }
    const measured = axisExtentMm(volume, measurement.axis)
    return {
      ...measurement,
      measuredMm: measured,
      errorMm: typeof measured === 'number' ? Math.abs(measured - measurement.expectedMm) : measured,
      method: 'axis-extent' as const,
    }
  })
}

export interface CenterlineError {
  meanMm: MetricValue
  p95Mm: MetricValue
  maxMm: MetricValue
}

export function centerlineDistance(phantom: Phantom, volume: ReconstructedVolume): CenterlineError {
  const line = phantom.centerline
  if (!line || line.length === 0) return { meanMm: 'NOT AVAILABLE', p95Mm: 'NOT AVAILABLE', maxMm: 'NOT AVAILABLE' }
  const occupied: Vec3[] = []
  const [sx, sy, sz] = volume.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (volume.observed[voxelIndex(volume.size, x, y, z)] === 1) occupied.push(voxelCenter(volume, x, y, z))
      }
    }
  }
  const distance = summarize(directed(line, occupied))
  return { meanMm: distance.meanMm, p95Mm: distance.p95Mm, maxMm: distance.hausdorffMm }
}
