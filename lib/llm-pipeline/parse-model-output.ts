import { z } from 'zod'
import type { Observation } from '@/lib/domain/types'
import { extractJson } from '@/lib/llm-pipeline/json-text'

const evidenceSchema = z.object({
  evidenceId: z.string().trim().min(1).max(80),
  frameTimeMs: z.number().finite().optional(),
  region: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().finite(),
      height: z.number().finite(),
    })
    .optional(),
})

const observationSchema = z.object({
  id: z.string().trim().min(1).max(80),
  feature: z.string().trim().min(1).max(500),
  polarity: z.enum(['present', 'absent', 'uncertain', 'not_assessed']),
  evidence: z.array(evidenceSchema).min(1),
  source: z.enum(['operator', 'model']).optional(),
})

const proposalSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(300),
  priority: z.string().trim().min(1).max(80),
  supportingObservationIds: z.array(z.string()).optional(),
  contradictingObservationIds: z.array(z.string()).optional(),
  missingEvidence: z.array(z.string().max(300)).optional(),
  limitations: z.array(z.string().max(300)).optional(),
})

export interface ProposedDiagnosis {
  id: string
  label: string
  priority: string
  supportingObservationIds: string[]
  contradictingObservationIds: string[]
  missingEvidence: string[]
  limitations: string[]
  banned: boolean
}

const PERCENT = /\d+(?:[.,]\d+)?\s*%/
const BANNED_KEY = /probab|likelihood|confidencepercent|percent/i

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function containsPercent(value: unknown): boolean {
  if (typeof value === 'string') return PERCENT.test(value)
  if (Array.isArray(value)) return value.some(containsPercent)
  return false
}

export function parseObservations(text: string, knownEvidenceIds: ReadonlySet<string>): Observation[] {
  const parsed = asRecord(extractJson(text))
  const list = parsed && Array.isArray(parsed.observations) ? parsed.observations : null
  if (!list) throw new Error('Brain 1 не вернул список наблюдений')
  const observations: Observation[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const result = observationSchema.safeParse(item)
    if (!result.success || seen.has(result.data.id)) continue
    const evidence = result.data.evidence.filter((itemRef) => knownEvidenceIds.has(itemRef.evidenceId))
    if (evidence.length === 0) continue
    seen.add(result.data.id)
    observations.push({
      id: result.data.id,
      feature: result.data.feature,
      polarity: result.data.polarity,
      evidence,
      source: 'model',
      reviewedByOperator: false,
    })
  }
  return observations
}

const REFERENCE_CLAUSE =
  /(?:референс|reference)\s*:\s*(?:[^0-9.\n]{0,24}\d+(?:[.,]\d+)?(?:\s*[×xх]\s*\d+(?:[.,]\d+)?){0,3}\s*(?:мм|см|мл|mm|cm|ml)?\s*){1,4}/gi

export function parseSonographerReport(text: string, source: string): string | undefined {
  const parsed = asRecord(extractJson(text))
  const report = parsed && typeof parsed.report === 'string' ? parsed.report.trim() : ''
  if (!report || report.length > 4000) return undefined
  if (PERCENT.test(report)) return undefined
  const known = new Set((source.match(/\d+(?:[.,]\d+)?/g) ?? []).map((number) => number.replace(',', '.')))
  const patientText = report.replace(REFERENCE_CLAUSE, ' ')
  const used = (patientText.match(/\d+(?:[.,]\d+)?/g) ?? []).map((number) => number.replace(',', '.'))
  if (used.some((number) => !known.has(number))) return undefined
  return report
}

export function parseProposals(text: string): ProposedDiagnosis[] {
  const parsed = asRecord(extractJson(text))
  const list = parsed && Array.isArray(parsed.differential) ? parsed.differential : null
  if (!list) throw new Error('Brain 2 не вернул дифференциал')
  const proposals: ProposedDiagnosis[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const record = asRecord(item)
    const bannedKey = record ? Object.keys(record).some((key) => BANNED_KEY.test(key)) : false
    const result = proposalSchema.safeParse(item)
    if (!result.success || seen.has(result.data.id)) continue
    seen.add(result.data.id)
    const banned = bannedKey || containsPercent(result.data.label) || containsPercent(result.data.limitations) || containsPercent(result.data.missingEvidence)
    proposals.push({
      id: result.data.id,
      label: result.data.label,
      priority: result.data.priority,
      supportingObservationIds: result.data.supportingObservationIds ?? [],
      contradictingObservationIds: result.data.contradictingObservationIds ?? [],
      missingEvidence: result.data.missingEvidence ?? [],
      limitations: result.data.limitations ?? [],
      banned,
    })
  }
  return proposals
}
