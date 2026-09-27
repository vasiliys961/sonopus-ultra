import type { DiagnosticResult, DiagnosisStatus } from '@/lib/domain/types'

export function applyOperatorDecision(
  result: DiagnosticResult,
  diagnosisId: string,
  status: Extract<DiagnosisStatus, 'operator_accepted' | 'operator_rejected'>,
): DiagnosticResult {
  if (!result.differential.some((item) => item.id === diagnosisId)) return result
  return {
    ...result,
    differential: result.differential.map((item) => (item.id === diagnosisId ? { ...item, status } : item)),
  }
}

export function editProposedLabel(result: DiagnosticResult, diagnosisId: string, label: string): DiagnosticResult {
  const next = label.trim()
  if (!next || next.length > 300) return result
  return {
    ...result,
    differential: result.differential.map((item) =>
      item.id === diagnosisId && item.status === 'model_proposed' ? { ...item, label: next } : item,
    ),
  }
}

/** Повторный ответ модели не меняет уже принятое или отклонённое врачом. */
export function lockOperatorDecisions(previous: DiagnosticResult | null, incoming: DiagnosticResult): DiagnosticResult {
  if (!previous || previous.studyId !== incoming.studyId) return incoming
  const lockedDx = new Map(
    previous.differential.filter((item) => item.status !== 'model_proposed').map((item) => [item.id, item]),
  )
  const lockedObs = new Map(
    previous.observations.filter((item) => item.reviewedByOperator).map((item) => [item.id, item]),
  )
  const differential = incoming.differential.map((item) => lockedDx.get(item.id) ?? item)
  for (const item of lockedDx.values()) {
    if (!differential.some((candidate) => candidate.id === item.id)) differential.push(item)
  }
  const observations = incoming.observations.map((item) => lockedObs.get(item.id) ?? item)
  for (const item of lockedObs.values()) {
    if (!observations.some((candidate) => candidate.id === item.id)) observations.push(item)
  }
  return { ...incoming, differential, observations }
}

export function readyToForward(result: DiagnosticResult): { ok: true } | { ok: false; reason: string } {
  if (result.clinicallyValidated !== false || result.formulaSource !== 'published-literature') {
    return { ok: false, reason: 'нарушен контракт клинической валидации' }
  }
  if (result.outcome === 'error' || result.outcome === 'unsupported_mode') {
    return { ok: false, reason: 'такой результат не передаётся' }
  }
  if (result.differential.some((item) => item.status === 'model_proposed')) {
    return { ok: false, reason: 'сначала примите или отклоните каждую гипотезу' }
  }
  if (
    (result.outcome === 'hypotheses_available' || result.outcome === 'low_confidence_hypothesis') &&
    !result.bodyRegion?.confirmedByOperator
  ) {
    return { ok: false, reason: 'область исследования не подтверждена' }
  }
  return { ok: true }
}
