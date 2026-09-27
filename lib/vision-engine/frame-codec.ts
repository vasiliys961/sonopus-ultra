import { base64ToBytes } from '@/lib/image/base64'
import type { UltrasoundFrame } from '@/lib/domain/types'

export function frameFromRgba(input: {
  sequenceNumber: number
  timestamp: number
  width: number
  height: number
  rgbaBase64: string
}): UltrasoundFrame {
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1) {
    throw new Error('пустой кадр')
  }
  const bytes = base64ToBytes(input.rgbaBase64)
  const needed = input.width * input.height * 4
  if (bytes.length < needed) throw new Error('битый кадр')
  const data = new Uint8ClampedArray(needed)
  data.set(bytes.subarray(0, needed))
  return {
    imageData: { width: input.width, height: input.height, data },
    timestamp: input.timestamp,
    sequenceNumber: input.sequenceNumber,
  }
}
