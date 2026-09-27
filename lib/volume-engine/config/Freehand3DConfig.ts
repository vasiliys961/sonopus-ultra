import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface VolumeResolutionConfig {
  voxelSizeMm: Vec3
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
  /** Если задан, оси вокселя независимы. Иначе все три равны voxelSizeMm. */
  voxelSize?: Vec3
  kernelRadius: number
  kernelSigmaMm: number
  minImageQuality: number
  pixelStride: 1 | 2 | 4
  maxSamplesPerFrame: number
  /** Явное разрешение использовать 2D-регистрацию, если learned-модель не подключена. */
  allowRegistrationFallback: boolean
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
  kernelRadius: 1,
  kernelSigmaMm: 1,
  minImageQuality: 0.15,
  pixelStride: 1,
  maxSamplesPerFrame: 250_000,
  allowRegistrationFallback: false,
  enableInterpolation: false,
  enableConfidenceVolume: true,
  enableCoverageMap: true,
  enablePhysicalMeasurements: false,
}

export function voxelSpacing(config: Freehand3DConfig): Vec3 {
  if (config.voxelSize) return config.voxelSize
  return [config.voxelSizeMm, config.voxelSizeMm, config.voxelSizeMm]
}

export function resolutionOf(config: Freehand3DConfig): VolumeResolutionConfig {
  return {
    voxelSizeMm: voxelSpacing(config),
    maxVoxels: config.maxVoxels,
    maxMemoryMB: config.maxMemoryMB,
  }
}
