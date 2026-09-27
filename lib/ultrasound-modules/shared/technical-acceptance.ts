import type { FrameAcceptance, OrganModule, QualityScore, UltrasoundFrame } from '@/lib/domain/types'
import { technicalHint } from '@/lib/quality/technical-hint'

export function acceptByTechnicalQuality(
  module: Pick<OrganModule, 'qualityThreshold'>,
  _frame: UltrasoundFrame,
  score: QualityScore,
): FrameAcceptance {
  if (score.qualityScore >= module.qualityThreshold) return { ok: true }
  return { ok: false, reason: technicalHint(score) }
}
