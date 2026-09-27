import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface VolumeCamera {
  target: Vec3
  distance: number
  yaw: number
  pitch: number
}

export function cameraOnVolume(origin: Vec3, size: readonly [number, number, number], spacing: Vec3): VolumeCamera {
  return {
    target: [
      origin[0] + (size[0] * spacing[0]) / 2,
      origin[1] + (size[1] * spacing[1]) / 2,
      origin[2] + (size[2] * spacing[2]) / 2,
    ],
    distance: Math.max(size[0] * spacing[0], size[1] * spacing[1], size[2] * spacing[2], 1),
    yaw: 0,
    pitch: 0,
  }
}
