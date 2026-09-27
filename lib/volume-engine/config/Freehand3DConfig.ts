export interface VolumeResolutionConfig {
  voxelSizeMm: number
  maxVoxels: number
  maxMemoryMB: number
}

export interface Freehand3DConfig {
  enabled: boolean
  poseProvider: 'reference' | 'registration' | 'sensor' | 'learned'
  learnedModel?: string
  minPoseConfidence: number
  voxelSizeMm: number
  maxVoxels: number
  maxMemoryMB: number
  maxStepMm: number
  maxRotationRad: number
  enableInterpolation: boolean
  enableConfidenceVolume: boolean
  enableCoverageMap: boolean
  /** Не открывает клинические измерения. Решение принимает статус объёма. */
  enablePhysicalMeasurements: boolean
}

export const DEFAULT_FREEHAND_CONFIG: Freehand3DConfig = {
  enabled: true,
  poseProvider: 'reference',
  minPoseConfidence: 0.35,
  voxelSizeMm: 1,
  maxVoxels: 64 * 64 * 64,
  maxMemoryMB: 32,
  maxStepMm: 40,
  maxRotationRad: Math.PI / 2,
  enableInterpolation: false,
  enableConfidenceVolume: true,
  enableCoverageMap: true,
  enablePhysicalMeasurements: false,
}

export function resolutionOf(config: Freehand3DConfig): VolumeResolutionConfig {
  return {
    voxelSizeMm: config.voxelSizeMm,
    maxVoxels: config.maxVoxels,
    maxMemoryMB: config.maxMemoryMB,
  }
}
