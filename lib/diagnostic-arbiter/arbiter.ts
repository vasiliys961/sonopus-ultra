import type {
  DiagnosticResult,
  Observation,
  PreliminaryDiagnosis,
  StudyView,
} from '@/lib/domain/types'
import { DIAGNOSTIC_SCHEMA_VERSION } from '@/lib/domain/types'
import type { ProposedDiagnosis } from '@/lib/llm-pipeline/parse-model-output'

const PRIORITIES = new Set(['consider', 'important_to_exclude', 'most_compatible'])

export interface ArbiterInput {
  studyId: string
  question: string
  bodyRegion?: { name: string; confirmedByOperator: boolean }
  views: StudyView[]
  requiredViews: readonly string[]
  observations: Observation[]
  proposals: ProposedDiagnosis[]
  knownEvidenceIds: ReadonlySet<string>
  acquisitionRequests?: string[]
  modelProvenance?: DiagnosticResult['modelProvenance']
  studyLimitations?: string[]
  qualityNotes?: string[]
}

function observationIsEvidenced(observation: Observation, knownEvidenceIds: ReadonlySet<string>): boolean {
  return observation.evidence.some((item) => knownEvidenceIds.has(item.evidenceId))
}

function confirmedView(view: StudyView, knownEvidenceIds: ReadonlySet<string>): boolean {
  return view.operatorConfirmed && view.evidenceIds.some((id) => knownEvidenceIds.has(id))
}

export function arbitrate(input: ArbiterInput): DiagnosticResult {
  const why: string[] = []
  const observations = input.observations.filter((item) => observationIsEvidenced(item, input.knownEvidenceIds))
  const byId = new Map(observations.map((item) => [item.id, item]))
  const differential: PreliminaryDiagnosis[] = []

  for (const proposal of input.proposals) {
    if (proposal.banned || !PRIORITIES.has(proposal.priority)) {
      why.push(`Гипотеза «${proposal.label}» отклонена: нет допустимого приоритета или в ответе есть процент вероятности.`)
      continue
    }
    const supporting = proposal.supportingObservationIds.filter((id) => {
      const observation = byId.get(id)
      return observation ? observationIsEvidenced(observation, input.knownEvidenceIds) : false
    })
    if (supporting.length === 0) {
      why.push(`Гипотеза «${proposal.label}» отклонена: нет наблюдения с реальной привязкой к кадру.`)
      continue
    }
    const contradicting = proposal.contradictingObservationIds.filter((id) => byId.has(id))
    differential.push({
      id: proposal.id,
      label: proposal.label,
      priority: proposal.priority as PreliminaryDiagnosis['priority'],
      supportingObservationIds: supporting,
      contradictingObservationIds: contradicting,
      missingEvidence: proposal.missingEvidence,
      limitations: [...proposal.limitations, ...(input.studyLimitations ?? [])],
      status: 'model_proposed',
    })
  }

  const views = input.views.map((view) => ({
    name: view.name,
    evidenceIds: view.evidenceIds.filter((id) => input.knownEvidenceIds.has(id)),
    operatorConfirmed: confirmedView(view, input.knownEvidenceIds),
  }))
  const present = new Set(views.filter((view) => view.operatorConfirmed).map((view) => view.name))
  const missingViews = input.requiredViews.filter((name) => !present.has(name))
  const requests = [...(input.acquisitionRequests ?? [])]
  for (const name of missingViews) requests.push(`Нужна подтверждённая проекция: ${name}`)

  const qualityLimitations = [...(input.qualityNotes ?? [])]
  for (const name of missingViews) qualityLimitations.push(`Не снята обязательная проекция: ${name}`)
  const onlyUncertain =
    differential.length > 0 &&
    differential.every((item) => item.supportingObservationIds.every((id) => byId.get(id)?.polarity === 'uncertain'))
  if (onlyUncertain) qualityLimitations.push('Наблюдения, на которых держится гипотеза, помечены как неясные.')

  let outcome: DiagnosticResult['outcome'] = 'hypotheses_available'
  if (differential.length === 0) {
    outcome = 'insufficient_evidence'
    why.push('Нет гипотезы, которая опирается на кадр. Это не заключение «патологии нет».')
    if (missingViews.length > 0) {
      why.push('Собраны не все обязательные проекции, поэтому отказ от находки был бы необоснованным.')
    }
  } else if (!input.bodyRegion?.confirmedByOperator) {
    outcome = 'insufficient_evidence'
    why.push('Область исследования не подтверждена врачом.')
  } else if (missingViews.length > 0 || onlyUncertain) {
    outcome = 'low_confidence_hypothesis'
  }

  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    studyId: input.studyId,
    question: input.question,
    bodyRegion: input.bodyRegion,
    views,
    observations,
    differential,
    outcome,
    qualityLimitations: outcome === 'low_confidence_hypothesis' ? qualityLimitations : undefined,
    whyCannotAssess: outcome === 'hypotheses_available' || outcome === 'low_confidence_hypothesis' || why.length === 0 ? undefined : why,
    acquisitionRequests: requests,
    modelProvenance: input.modelProvenance,
    formulaSource: 'published-literature',
    clinicallyValidated: false,
  }
}
