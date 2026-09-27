import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'

export interface SplatSample {
  point: Vec3
  gray: number
  confidence: number
  quality: number
}

export function sampleSlice(slice: VolumeSliceSample): SplatSample[] {
  if (slice.pixelSpacingX == null || slice.pixelSpacingY == null) return []
  if (slice.image.length !== slice.width * slice.height) {
    throw new Error('длина кадра не совпадает с шириной и высотой')
  }
  const samples: SplatSample[] = []
  for (let v = 0; v < slice.height; v += 1) {
    for (let u = 0; u < slice.width; u += 1) {
      const index = v * slice.width + u
      if (slice.fieldMask && slice.fieldMask[index] !== 1) continue
      const local: Vec3 = [
        (u + 0.5 - slice.width / 2) * slice.pixelSpacingX,
        (v + 0.5 - slice.height / 2) * slice.pixelSpacingY,
        0,
      ]
      samples.push({
        point: transformPoint(slice.transform, local),
        gray: slice.image[index] ?? 0,
        confidence: slice.confidence,
        quality: slice.quality,
      })
    }
  }
  return samples
}

export function worldPoint(transform: Mat4, local: Vec3): Vec3 {
  return transformPoint(transform, local)
}
