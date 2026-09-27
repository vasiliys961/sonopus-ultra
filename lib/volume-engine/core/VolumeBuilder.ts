import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { gridSize, type VolumeBounds } from '@/lib/volume-engine/core/VolumeBounds'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { VolumeResolutionConfig } from '@/lib/volume-engine/config/Freehand3DConfig'

export function voxelIndex(size: readonly [number, number, number], x: number, y: number, z: number): number {
  return x + size[0] * (y + size[1] * z)
}

/** Суммы, веса, уверенность и выходные массивы. Считается до выделения. */
export function estimateVolumeBytes(cells: number): number {
  return cells * (4 + 4 + 4 + 4 + 4 + 4 + 1 + 1)
}

export function assertGridFits(size: readonly [number, number, number], resolution: VolumeResolutionConfig): void {
  const cells = size[0] * size[1] * size[2]
  if (!Number.isFinite(cells) || cells <= 0) {
    throw new VolumeEngineError('INVALID_VOXEL_SIZE', 'Сетка объёма не собралась.')
  }
  if (cells > resolution.maxVoxels) {
    throw new VolumeEngineError('VOLUME_TOO_LARGE', 'Сетка объёма больше заданного числа вокселей.')
  }
  const megabytes = estimateVolumeBytes(cells) / (1024 * 1024)
  if (megabytes > resolution.maxMemoryMB) {
    throw new VolumeEngineError('VOLUME_MEMORY_LIMIT_EXCEEDED', `Оценка памяти ${megabytes.toFixed(2)} МБ больше лимита ${resolution.maxMemoryMB} МБ.`)
  }
}

export function allocateGrid(bounds: VolumeBounds, spacingMm: Vec3, resolution: VolumeResolutionConfig): {
  originMm: Vec3
  size: [number, number, number]
  spacingMm: Vec3
  sums: Float32Array
  weights: Float32Array
  confidence: Float32Array
} {
  const size = gridSize(bounds, spacingMm)
  assertGridFits(size, resolution)
  const cells = size[0] * size[1] * size[2]
  return {
    originMm: bounds.min,
    size,
    spacingMm,
    sums: new Float32Array(cells),
    weights: new Float32Array(cells),
    confidence: new Float32Array(cells),
  }
}
