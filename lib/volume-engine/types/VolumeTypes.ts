import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { PoseMode, VolumeStatus } from '@/lib/volume-engine/types/VolumeStatus'
import type { VolumeSource } from '@/lib/volume-engine/types/VolumeSource'

export type { Mat4, Vec3 }

export interface ReconstructedVolume {
  originMm: Vec3
  spacingMm: Vec3
  size: [number, number, number]
  scalars: Float32Array
  observed: Uint8Array
  interpolated: Uint8Array
  confidence: Float32Array
  coverage: Float32Array
  source: VolumeSource
  status: VolumeStatus
  poseMode: PoseMode
  clinicallyValidated: false
}

export function emptyVolume(source: VolumeSource, status: VolumeStatus, poseMode: PoseMode): ReconstructedVolume {
  return {
    originMm: [0, 0, 0],
    spacingMm: [0, 0, 0],
    size: [0, 0, 0],
    scalars: new Float32Array(),
    observed: new Uint8Array(),
    interpolated: new Uint8Array(),
    confidence: new Float32Array(),
    coverage: new Float32Array(),
    source,
    status,
    poseMode,
    clinicallyValidated: false,
  }
}

/** Клинические миллиметры открыты только у эталонного теста. Флаг конфигурации это не включает. */
export function physicalMeasuresAllowed(volume: Pick<ReconstructedVolume, 'status' | 'poseMode'>): boolean {
  return volume.poseMode === 'reference_test' && volume.status === 'validated_reference'
}
