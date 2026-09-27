import { coverageRatio, meanCoverage } from '@/lib/volume-engine/reconstruction/CoverageMap'
import type { PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface ReconstructionTelemetry {
  pose_provider: string
  model_id: string
  model_version: string | null
  frame_count: number
  accepted_frames: number
  rejected_frames: number
  mean_pose_confidence: number
  trajectory_length: number
  coverage: number
  reconstruction_time: number
  render_time: number
}

export function buildTelemetry(input: {
  provider: PoseProvider
  frames: number
  accepted: number
  rejected: number
  volume: ReconstructedVolume
  trajectoryLengthMm: number
  reconstructionMs: number
  renderMs?: number
}): ReconstructionTelemetry {
  let confidenceSum = 0
  let confidenceCount = 0
  for (let index = 0; index < input.volume.observed.length; index += 1) {
    if (input.volume.observed[index] !== 1) continue
    confidenceSum += input.volume.confidence[index] ?? 0
    confidenceCount += 1
  }
  return {
    pose_provider: input.provider.mode,
    model_id: input.provider.id,
    model_version: null,
    frame_count: input.frames,
    accepted_frames: input.accepted,
    rejected_frames: input.rejected,
    mean_pose_confidence: confidenceCount === 0 ? 0 : confidenceSum / confidenceCount,
    trajectory_length: input.trajectoryLengthMm,
    coverage: coverageRatio(input.volume.observed),
    reconstruction_time: input.reconstructionMs,
    render_time: input.renderMs ?? 0,
  }
}

export function meanObservedConfidence(volume: ReconstructedVolume): number {
  return meanCoverage(volume.confidence, volume.observed)
}
