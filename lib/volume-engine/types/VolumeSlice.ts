import type { Mat4 } from '@/lib/spatial-reconstruction/types'

export interface VolumeSliceSample {
  frameId: string
  timestamp: number
  image: Float32Array
  width: number
  height: number
  transform: Mat4
  confidence: number
  pixelSpacingX: number | null
  pixelSpacingY: number | null
  quality: number
  fieldMask?: Uint8Array
  source: 'dicom' | 'ultrasound'
}
