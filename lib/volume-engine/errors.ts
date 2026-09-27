export const VOLUME_ERROR_CODES = [
  'POSE_MODEL_UNAVAILABLE',
  'POSE_LOW_CONFIDENCE',
  'POSE_JUMP',
  'CALIBRATION_MISSING',
  'INSUFFICIENT_COVERAGE',
  'RECONSTRUCTION_UNSTABLE',
  'VOLUME_TOO_LARGE',
  'VOLUME_MEMORY_LIMIT_EXCEEDED',
  'UNSUPPORTED_MODEL',
  'INVALID_TRANSFORM',
  'INVALID_CALIBRATION',
  'INVALID_VOXEL_SIZE',
  'STEP_TOO_LARGE',
  'ROTATION_TOO_LARGE',
  'IMAGE_QUALITY_LOW',
  'INSUFFICIENT_FRAMES',
  'REGISTRATION_FAILED',
  'RECONSTRUCTION_FAILED',
] as const

export type VolumeErrorCode = (typeof VOLUME_ERROR_CODES)[number]

export class VolumeEngineError extends Error {
  readonly code: VolumeErrorCode

  constructor(code: VolumeErrorCode, message: string) {
    super(message)
    this.name = 'VolumeEngineError'
    this.code = code
  }
}
