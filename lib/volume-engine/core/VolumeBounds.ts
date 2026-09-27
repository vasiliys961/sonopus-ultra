import type { Vec3 } from '@/lib/spatial-reconstruction/types'

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

export function gridSize(bounds: VolumeBounds, voxelMm: number): [number, number, number] {
  return [
    Math.floor((bounds.max[0] - bounds.min[0]) / voxelMm) + 1,
    Math.floor((bounds.max[1] - bounds.min[1]) / voxelMm) + 1,
    Math.floor((bounds.max[2] - bounds.min[2]) / voxelMm) + 1,
  ]
}
