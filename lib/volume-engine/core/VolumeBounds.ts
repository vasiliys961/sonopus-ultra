import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

export interface VolumeBounds {
  min: Vec3
  max: Vec3
}

export function boundsOf(points: readonly Vec3[]): VolumeBounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point[0])
    minY = Math.min(minY, point[1])
    minZ = Math.min(minZ, point[2])
    maxX = Math.max(maxX, point[0])
    maxY = Math.max(maxY, point[1])
    maxZ = Math.max(maxZ, point[2])
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

export function gridSize(bounds: VolumeBounds, spacingMm: Vec3): [number, number, number] {
  return [0, 1, 2].map((axis) => {
    const step = spacingMm[axis]
    if (step == null || !Number.isFinite(step) || step <= 0) {
      throw new VolumeEngineError('INVALID_VOXEL_SIZE', 'шаг вокселя: ожидается число больше нуля, мм')
    }
    return Math.floor((bounds.max[axis] - bounds.min[axis]) / step) + 1
  }) as [number, number, number]
}
