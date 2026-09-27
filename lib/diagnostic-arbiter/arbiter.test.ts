import { describe, expect, it } from 'vitest'
import type { Observation, StudyView } from '@/lib/domain/types'
import { arbitrate } from '@/lib/diagnostic-arbiter/arbiter'
import { applyOperatorDecision, lockOperatorDecisions, readyToForward } from '@/lib/diagnostic-arbiter/review'
import type { ProposedDiagnosis } from '@/lib/llm-pipeline/parse-model-output'

const observation: Observation = {
  id: 'obs_1',
  feature: 'анэхогенная полость',
  polarity: 'present',
  evidence: [{ evidenceId: 'frame-1' }],
  source: 'model',
  reviewedByOperator: false,
}

const views: StudyView[] = [
  { name: 'transverse', evidenceIds: ['frame-1'], operatorConfirmed: true },
  { name: 'longitudinal', evidenceIds: ['frame-1'], operatorConfirmed: true },
]

function proposal(patch: Partial<ProposedDiagnosis> = {}): ProposedDiagnosis {
  return {
    id: 'dx_1',
    label: 'задержка мочи',
    priority: 'consider',
    supportingObservationIds: ['obs_1'],
    contradictingObservationIds: [],
    missingEvidence: [],
    limitations: [],
    banned: false,
    ...patch,
  }
}

function run(patch: Partial<Parameters<typeof arbitrate>[0]> = {}) {
  return arbitrate({
    studyId: 'study-1',
    question: 'объём',
    bodyRegion: { name: 'мочевой пузырь', confirmedByOperator: true },
    views,
    requiredViews: ['transverse', 'longitudinal'],
    observations: [observation],
    proposals: [proposal()],
    knownEvidenceIds: new Set(['frame-1']),
    ...patch,
  })
}

describe('диагностический арбитр', () => {
  it('пропускает гипотезу с существующим наблюдением и кадром', () => {
    const result = run()
    expect(result.outcome).toBe('hypotheses_available')
    expect(result.differential).toHaveLength(1)
    expect(result.clinicallyValidated).toBe(false)
  })

  it('отклоняет гипотезу без supportingObservationIds', () => {
    const result = run({ proposals: [proposal({ supportingObservationIds: [] })] })
    expect(result.differential).toHaveLength(0)
    expect(result.outcome).toBe('insufficient_evidence')
    expect(result.whyCannotAssess?.join(' ')).toMatch(/привязк/)
  })

  it('отклоняет ссылку на несуществующий кадр', () => {
    const floating: Observation = { ...observation, evidence: [{ evidenceId: 'missing' }] }
    const result = run({ observations: [floating] })
    expect(result.differential).toHaveLength(0)
    expect(result.outcome).toBe('insufficient_evidence')
  })

  it('отклоняет проценты и не оставляет их с предупреждением', () => {
    const result = run({ proposals: [proposal({ label: 'вероятность 80%', banned: true })] })
    expect(result.differential).toHaveLength(0)
    expect(result.outcome).toBe('insufficient_evidence')
  })

  it('понижает исход, если обязательная проекция не подтверждена', () => {
    const result = run({ views: [views[0]] })
    expect(result.outcome).toBe('low_confidence_hypothesis')
    expect(result.differential).toHaveLength(1)
    expect(result.qualityLimitations?.join(' ')).toMatch(/проекц/)
    expect(result.outcome).not.toBe('hypotheses_available')
  })

  it('оставляет гипотезу на неясных наблюдениях и помечает низкую достоверность', () => {
    const uncertain: Observation = { ...observation, polarity: 'uncertain' }
    const result = run({ observations: [uncertain] })
    expect(result.differential).toHaveLength(1)
    expect(result.outcome).toBe('low_confidence_hypothesis')
    expect(result.qualityLimitations?.length).toBeGreaterThan(0)
  })

  it('не показывает дифференциал как значимый без подтверждённой области', () => {
    const result = run({ bodyRegion: { name: 'мочевой пузырь', confirmedByOperator: false } })
    expect(result.outcome).toBe('insufficient_evidence')
    expect(result.whyCannotAssess?.join(' ')).toMatch(/не подтверждена/)
  })

  it('не даёт модели перезаписать решение врача', () => {
    const accepted = applyOperatorDecision(run(), 'dx_1', 'operator_accepted')
    const rerun = lockOperatorDecisions(accepted, {
      ...run(),
      differential: [{ ...run().differential[0], label: 'другая формулировка', status: 'model_proposed' }],
    })
    expect(rerun.differential[0]?.status).toBe('operator_accepted')
    expect(rerun.differential[0]?.label).toBe('задержка мочи')
    expect(readyToForward(accepted).ok).toBe(true)
    expect(readyToForward(run()).ok).toBe(false)
  })
})
