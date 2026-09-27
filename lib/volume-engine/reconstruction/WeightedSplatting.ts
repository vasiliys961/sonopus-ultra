import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { SplatSample } from '@/lib/volume-engine/core/VolumeSampler'

export interface WeightGrid {
  originMm: Vec3
  size: [number, number, number]
  voxelMm: number
  sums: Float32Array
  weights: Float32Array
  confidence: Float32Array
}

export function splatSample(grid: WeightGrid, sample: SplatSample): void {
  const { originMm, size, voxelMm } = grid
  const ix = Math.min(size[0] - 1, Math.max(0, Math.round((sample.point[0] - originMm[0]) / voxelMm)))
  const iy = Math.min(size[1] - 1, Math.max(0, Math.round((sample.point[1] - originMm[1]) / voxelMm)))
  const iz = Math.min(size[2] - 1, Math.max(0, Math.round((sample.point[2] - originMm[2]) / voxelMm)))
  const centerX = originMm[0] + ix * voxelMm
  const centerY = originMm[1] + iy * voxelMm
  const centerZ = originMm[2] + iz * voxelMm
  const distance2 = (sample.point[0] - centerX) ** 2 + (sample.point[1] - centerY) ** 2 + (sample.point[2] - centerZ) ** 2
  const spatial = Math.exp(-distance2 / (2 * voxelMm * voxelMm))
  const weight = sample.confidence * sample.quality * spatial
  if (weight <= 0) return
  const index = voxelIndex(size, ix, iy, iz)
  grid.sums[index] = (grid.sums[index] ?? 0) + sample.gray * weight
  grid.weights[index] = (grid.weights[index] ?? 0) + weight
  grid.confidence[index] = (grid.confidence[index] ?? 0) + sample.confidence * weight
}
