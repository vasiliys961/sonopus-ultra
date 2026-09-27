import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'

export interface SplatSample {
  point: Vec3
  gray: number
  confidence: number
  quality: number
}

export interface SamplingConfig {
  pixelStride: 1 | 2 | 4
  maxSamplesPerFrame: number
  roi?: { x: number; y: number; width: number; height: number }
}

export function assertMillimeters(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new VolumeEngineError('INVALID_CALIBRATION', `${name}: ожидается шкала в миллиметрах больше нуля.`)
  }
}

export function sampleSlice(slice: VolumeSliceSample, sampling?: SamplingConfig): SplatSample[] {
  if (slice.pixelSpacingX == null || slice.pixelSpacingY == null) return []
  assertMillimeters(slice.pixelSpacingX, 'pixelSpacingX')
  assertMillimeters(slice.pixelSpacingY, 'pixelSpacingY')
  if (slice.image.length !== slice.width * slice.height) {
    throw new Error('длина кадра не совпадает с шириной и высотой')
  }
  const requested = sampling?.pixelStride ?? 1
  const roi = sampling?.roi
  const x0 = roi ? Math.max(0, roi.x) : 0
  const y0 = roi ? Math.max(0, roi.y) : 0
  const x1 = roi ? Math.min(slice.width, roi.x + roi.width) : slice.width
  const y1 = roi ? Math.min(slice.height, roi.y + roi.height) : slice.height
  let stride: number = requested
  const cap = sampling?.maxSamplesPerFrame ?? Number.POSITIVE_INFINITY
  while (Math.ceil((x1 - x0) / stride) * Math.ceil((y1 - y0) / stride) > cap && stride < 16) stride *= 2
  const samples: SplatSample[] = []
  for (let v = y0; v < y1; v += stride) {
    for (let u = x0; u < x1; u += stride) {
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
