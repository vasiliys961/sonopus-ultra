import type { LesionCandidate, ArtifactNote } from '@/types/pathology'
import type { InPlaneShift, KeyFrame, TemporalSequence, TemporalSummary } from '@/types/temporal-ultrasound'
import type { USFrame } from '@/types/spatial-ultrasound'

export interface AnatomyNode {
  name: string
  observed: false
  source: 'ATLAS_INFERRED'
}

export interface StructuredReport {
  examination: string[]
  anatomy: string[]
  findings: string[]
  candidates: string[]
  limitations: string[]
  conclusion: string
}

export interface TissueCharacterization {
  candidateId: string
  echogenicity: 'ниже окружения' | 'выше окружения'
  basis: 'относительная яркость эхо'
}

export interface UltrasoundStudy {
  id: string
  organ: string
  frames: USFrame[]
  keyFrames: KeyFrame[]
  sequences: TemporalSequence[]
  temporal: TemporalSummary
  shift: InPlaneShift
  acceptedFrames: number
  coverage: number
  pose: 'VIDEO_ESTIMATION'
  measuresAllowed: false
  anatomy: AnatomyNode[]
  candidates: LesionCandidate[]
  tissue: TissueCharacterization[]
  resampled: boolean
  artifacts: ArtifactNote[]
  dataStatus: 'OK' | 'INSUFFICIENT DATA'
  report: StructuredReport
}
