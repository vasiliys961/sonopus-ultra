import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { SplatSample } from '@/lib/volume-engine/core/VolumeSampler'

export interface WeightGrid {
  originMm: Vec3
  size: [number, number, number]
  spacingMm: Vec3
  kernelRadius: number
  kernelSigmaMm: number
  sums: Float32Array
  weights: Float32Array
  confidence: Float32Array
}

function clampIndex(value: number, limit: number): number {
  return Math.min(limit - 1, Math.max(0, value))
}

/** Вес делится между соседними вокселями и в сумме равен уверенности кадра × качеству. */
export function splatSample(grid: WeightGrid, sample: SplatSample): void {
  const { originMm, size, spacingMm } = grid
  const radius = Math.max(0, grid.kernelRadius)
  const sigma = grid.kernelSigmaMm > 0 ? grid.kernelSigmaMm : Math.max(spacingMm[0], spacingMm[1], spacingMm[2])
  const anchor: [number, number, number] = [
    clampIndex(Math.round((sample.point[0] - originMm[0]) / spacingMm[0]), size[0]),
    clampIndex(Math.round((sample.point[1] - originMm[1]) / spacingMm[1]), size[1]),
    clampIndex(Math.round((sample.point[2] - originMm[2]) / spacingMm[2]), size[2]),
  ]
  const bins: Array<{ index: number; spatial: number }> = []
  let spatialSum = 0
  for (let dz = -radius; dz <= radius; dz += 1) {
    const iz = anchor[2] + dz
    if (iz < 0 || iz >= size[2]) continue
    for (let dy = -radius; dy <= radius; dy += 1) {
      const iy = anchor[1] + dy
      if (iy < 0 || iy >= size[1]) continue
      for (let dx = -radius; dx <= radius; dx += 1) {
        const ix = anchor[0] + dx
        if (ix < 0 || ix >= size[0]) continue
        const centerX = originMm[0] + ix * spacingMm[0]
        const centerY = originMm[1] + iy * spacingMm[1]
        const centerZ = originMm[2] + iz * spacingMm[2]
        const distance2 = (sample.point[0] - centerX) ** 2 + (sample.point[1] - centerY) ** 2 + (sample.point[2] - centerZ) ** 2
        const spatial = Math.exp(-distance2 / (2 * sigma * sigma))
        spatialSum += spatial
        bins.push({ index: voxelIndex(size, ix, iy, iz), spatial })
      }
    }
  }
  if (spatialSum <= 0) return
  const gain = sample.confidence * sample.quality
  if (gain <= 0) return
  for (const bin of bins) {
    const weight = gain * (bin.spatial / spatialSum)
    grid.sums[bin.index] = (grid.sums[bin.index] ?? 0) + sample.gray * weight
    grid.weights[bin.index] = (grid.weights[bin.index] ?? 0) + weight
    grid.confidence[bin.index] = (grid.confidence[bin.index] ?? 0) + sample.confidence * weight
  }
}
