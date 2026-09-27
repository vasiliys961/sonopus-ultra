import { multiplyMat4 } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4 } from '@/lib/spatial-reconstruction/types'
import type { UltrasoundCalibration } from '@/lib/volume-engine/types/VolumeCalibration'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'

export interface UltrasoundFrameInput {
  frameId: string
  timestamp: number
  image: Float32Array
  width: number
  height: number
  transform: Mat4
  confidence: number
  calibration: UltrasoundCalibration | null
  fieldMask?: Uint8Array
  quality?: number
}

export function ultrasoundSlice(frame: UltrasoundFrameInput): VolumeSliceSample | null {
  if (!frame.calibration) return null
  return {
    frameId: frame.frameId,
    timestamp: frame.timestamp,
    image: frame.image,
    width: frame.width,
    height: frame.height,
    transform: frame.calibration.probeOrientation
      ? multiplyMat4(frame.transform, frame.calibration.probeOrientation)
      : frame.transform,
    confidence: frame.confidence,
    pixelSpacingX: frame.calibration.pixelSpacingX,
    pixelSpacingY: frame.calibration.pixelSpacingY,
    quality: frame.quality ?? 1,
    fieldMask: frame.fieldMask,
    source: 'ultrasound',
  }
}
