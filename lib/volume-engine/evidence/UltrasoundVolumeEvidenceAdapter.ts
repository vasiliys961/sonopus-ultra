import type { VolumeBuildResult } from '@/lib/volume-engine/core/VolumeEngine'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'

export interface VolumeEvidence {
  source: 'ultrasound'
  volumeStatus: string
  poseMode: string
  frameCount: number
  acceptedFrames: number
  rejectedFrames: number
  coverage: number
  poseConfidence: number
  trajectoryLengthMm: number
  uncertaintyMm?: number
}

export function toVolumeEvidence(result: VolumeBuildResult): VolumeEvidence {
  const uncertainty = result.trajectory.find((point) => point.uncertaintyMm != null)?.uncertaintyMm
  return {
    source: 'ultrasound',
    volumeStatus: result.volume.status,
    poseMode: result.volume.poseMode,
    frameCount: result.telemetry.frame_count,
    acceptedFrames: result.acceptedFrames,
    rejectedFrames: result.rejectedFrames,
    coverage: coverageRatio(result.volume.observed),
    poseConfidence: result.telemetry.mean_pose_confidence,
    trajectoryLengthMm: result.telemetry.trajectory_length,
    uncertaintyMm: uncertainty ?? undefined,
  }
}

/** Текст для пакета доказательств. В промпт Brain 2 и в диагноз это не подставляется. */
export function volumeEvidenceNote(evidence: VolumeEvidence): string {
  if (evidence.poseMode === 'reference_test' && evidence.volumeStatus === 'validated_reference') {
    return 'Объём построен по эталонной тестовой траектории.'
  }
  return 'EXPERIMENTAL RECONSTRUCTION. Spatial geometry is estimated. Physical measurements are not clinically validated.'
}
