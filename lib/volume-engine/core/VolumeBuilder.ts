import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { gridSize, type VolumeBounds } from '@/lib/volume-engine/core/VolumeBounds'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { VolumeResolutionConfig } from '@/lib/volume-engine/config/Freehand3DConfig'

export function voxelIndex(size: readonly [number, number, number], x: number, y: number, z: number): number {
  return x + size[0] * (y + size[1] * z)
}

export function assertGridFits(size: readonly [number, number, number], resolution: VolumeResolutionConfig): void {
  const cells = size[0] * size[1] * size[2]
  if (cells > resolution.maxVoxels) {
    throw new VolumeEngineError('VOLUME_TOO_LARGE', 'Сетка объёма больше заданного числа вокселей.')
  }
  const megabytes = (cells * 16) / (1024 * 1024)
  if (megabytes > resolution.maxMemoryMB) {
    throw new VolumeEngineError('VOLUME_TOO_LARGE', 'Сетка объёма больше заданной памяти.')
  }
}

export function allocateGrid(bounds: VolumeBounds, voxelMm: number, resolution: VolumeResolutionConfig): {
  originMm: Vec3
  size: [number, number, number]
  sums: Float32Array
  weights: Float32Array
  confidence: Float32Array
} {
  const size = gridSize(bounds, voxelMm)
  assertGridFits(size, resolution)
  const cells = size[0] * size[1] * size[2]
  return {
    originMm: bounds.min,
    size,
    sums: new Float32Array(cells),
    weights: new Float32Array(cells),
    confidence: new Float32Array(cells),
  }
}
