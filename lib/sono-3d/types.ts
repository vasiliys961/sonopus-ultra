import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

/** Плоскость кадра в миллиметрах объёма: p' = M · p. */
export type PoseSource = 'reference' | 'predicted' | 'manual_assumption'

export type VolumeStatus = 'validated_reference' | 'experimental_estimated' | 'preview_only' | 'unavailable'

export type PoseMode = 'reference_test' | 'estimated_research' | 'demo_without_measures'

export const POSE_MODEL_UNAVAILABLE = 'POSE_MODEL_UNAVAILABLE'

export interface FramePose {
  frameIndex: number
  matrix: Mat4
  source: PoseSource
  uncertaintyMm: number | null
  algorithmVersion: string
}

export interface SweepFrame {
  gray: Float32Array
  width: number
  height: number
  /** 1 — пиксель внутри активного поля. Вне поля пиксель не попадает в объём. */
  field: Uint8Array
  mmPerPixelX: number | null
  mmPerPixelY: number | null
  pose: FramePose
}

export interface ReconstructedVolume {
  originMm: Vec3
  spacingMm: number | null
  size: [number, number, number]
  scalars: Float32Array
  observed: Uint8Array
  interpolated: Uint8Array
  prior: Uint8Array
  status: VolumeStatus
  poseMode: PoseMode
  clinicallyValidated: false
}

export interface ReconstructionQC {
  observedVoxels: number
  unknownVoxels: number
  poseMode: PoseMode
  reason: string | null
}

export function physicalMeasuresAllowed(volume: Pick<ReconstructedVolume, 'status' | 'spacingMm' | 'poseMode'>): boolean {
  return volume.poseMode === 'reference_test' && volume.status === 'validated_reference' && volume.spacingMm != null && volume.spacingMm > 0
}
