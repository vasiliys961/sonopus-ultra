import type { Observation } from '@/lib/domain/types'
import type { Brain2Request } from '@/lib/llm-pipeline/sono-brain2'
import type { EvidencePack } from '@/lib/vision-engine/evidence/evidence-pack'

export interface Brain2EvidenceContext {
  ready: boolean
  reason: 'insufficient_evidence' | null
  request: {
    views: Brain2Request['views']
    observations: Observation[]
    measurement: Brain2Request['measurement']
    bodyRegion?: Brain2Request['bodyRegion']
  } | null
}

export function toBrain2Context(pack: EvidencePack): Brain2EvidenceContext {
  const framed = pack.observations.filter((item) => item.frameIds.length > 0)
  if (pack.selectedFrames.length === 0 || framed.length === 0) {
    return { ready: false, reason: 'insufficient_evidence', request: null }
  }
  const contradicted = pack.contradictions.length > 0
  const observations: Observation[] = framed.map((item) => ({
    id: item.id,
    feature: item.label,
    polarity: !contradicted && item.confidence >= 0.75 && !item.uncertaintyReason ? 'present' : 'uncertain',
    evidence: item.frameIds.map((evidenceId) => ({ evidenceId })),
    source: 'model',
    reviewedByOperator: false,
  }))
  const anatomy = pack.anatomy[0]
  return {
    ready: true,
    reason: null,
    request: {
      bodyRegion: anatomy ? { name: anatomy.organ, confirmedByOperator: false } : undefined,
      views: pack.protocol.completed.map((name) => ({
        name,
        evidenceIds: pack.selectedFrames.map((frame) => frame.id),
        operatorConfirmed: false,
      })),
      observations,
      measurement: {
        candidates: pack.measurements.filter((item) => item.validationStatus !== 'validated'),
        validated: pack.measurements.filter((item) => item.validationStatus === 'validated'),
        contradictions: pack.contradictions,
        uncertainties: pack.uncertainties,
      },
    },
  }
}
