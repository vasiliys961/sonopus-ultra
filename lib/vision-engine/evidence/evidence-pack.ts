import type { AnatomyObservation } from '@/lib/vision-engine/anatomy/anatomy-detector'
import type { Contradiction } from '@/lib/vision-engine/evidence/contradictions'
import type { MeasurementCandidate } from '@/lib/vision-engine/measurement/candidates'
import type { PlaneObservation } from '@/lib/vision-engine/plane/plane-detector'
import type { ProtocolState } from '@/lib/vision-engine/protocol/protocol-state'
import type { SelectedClip } from '@/lib/vision-engine/selection/clip-selector'
import type { VisionObservationDraft } from '@/lib/vision-engine/types'

export interface EvidencePack {
  studyId: string
  anatomy: AnatomyObservation[]
  planes: PlaneObservation[]
  measurements: MeasurementCandidate[]
  observations: VisionObservationDraft[]
  selectedFrames: Array<{ id: string; timestamp: number }>
  selectedClips: SelectedClip[]
  protocol: ProtocolState
  qualitySummary: { mean: number; frames: number }
  uncertainties: string[]
  contradictions: Contradiction[]
  completeness: number
  generatedAt: string
}

export function buildEvidencePack(input: {
  studyId: string
  anatomy: AnatomyObservation[]
  planes: PlaneObservation[]
  measurements: MeasurementCandidate[]
  observations: VisionObservationDraft[]
  selectedFrames: Array<{ id: string; timestamp: number; qualityScore: number }>
  selectedClips: SelectedClip[]
  protocol: ProtocolState
  uncertainties: string[]
  contradictions: Contradiction[]
  generatedAt: string
}): EvidencePack {
  const mean = input.selectedFrames.length === 0
    ? 0
    : input.selectedFrames.reduce((sum, frame) => sum + frame.qualityScore, 0) / input.selectedFrames.length
  return {
    studyId: input.studyId,
    anatomy: input.anatomy,
    planes: input.planes,
    measurements: input.measurements,
    observations: input.observations,
    selectedFrames: input.selectedFrames.map((frame) => ({ id: frame.id, timestamp: frame.timestamp })),
    selectedClips: input.selectedClips,
    protocol: input.protocol,
    qualitySummary: { mean, frames: input.selectedFrames.length },
    uncertainties: input.uncertainties,
    contradictions: input.contradictions,
    completeness: input.protocol.completeness,
    generatedAt: input.generatedAt,
  }
}
