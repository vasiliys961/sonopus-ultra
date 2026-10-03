import type { FindingProvenance } from '@/types/provenance'

export type CandidateKind = 'hypoechoic' | 'hyperechoic'

export interface LesionCandidate {
  id: string
  kind: CandidateKind
  location: { x: number; y: number; z: number }
  /** Стороны пятна в ячейках сетки, не в миллиметрах пациента. */
  extent: { x: number; y: number; z: number }
  voxelCount: number
  echogenicity: 'ниже окружения' | 'выше окружения'
  /** Сопоставленные кадры, где знак яркости в точке тот же. Не трекинг. */
  hold: { matched: number; sameSign: number }
  provenance: FindingProvenance
}

export interface ArtifactNote {
  id: string
  label: string
  voxelCount: number
}
