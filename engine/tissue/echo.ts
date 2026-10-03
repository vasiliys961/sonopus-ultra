import type { LesionCandidate } from '@/types/pathology'
import type { TissueCharacterization } from '@/types/study'

/** Только относительная яркость. Затухание, жёсткость и поток из кадра не читаются. */
export function tissueFromCandidates(candidates: readonly LesionCandidate[]): TissueCharacterization[] {
  return candidates.map((item) => ({
    candidateId: item.id,
    echogenicity: item.echogenicity,
    basis: 'относительная яркость эхо',
  }))
}
