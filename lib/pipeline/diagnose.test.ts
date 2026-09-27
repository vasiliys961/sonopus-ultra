import { describe, expect, it } from 'vitest'
import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import { prepareFramesForModel, runDiagnosticPipeline, type DiagnoseCommand } from '@/lib/pipeline/diagnose'
import { assertForwardable } from '@/lib/pipeline/forward'

function raster(fill = 0) {
  const data = new Uint8ClampedArray(16 * 16 * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill
    data[i + 1] = fill
    data[i + 2] = fill
    data[i + 3] = 255
  }
  return { width: 16, height: 16, data }
}

function command(patch: Partial<DiagnoseCommand> = {}): DiagnoseCommand {
  return {
    studyId: 'study-1',
    moduleId: 'bladder',
    question: 'Оценить объём',
    bodyRegion: { name: 'мочевой пузырь', confirmedByOperator: true },
    views: [
      { name: 'transverse', evidenceIds: ['frame-t'], operatorConfirmed: true, qualityScore: 0.9 },
      { name: 'longitudinal', evidenceIds: ['frame-l'], operatorConfirmed: true, qualityScore: 0.91 },
    ],
    calibration: { status: 'verified', source: 'device-calipers', attestedByOperator: true },
    manual: { kind: 'bladder', depthMm: 100, widthMm: 80, heightMm: 60 },
    frames: [
      { evidenceId: 'frame-t', timestamp: 1, sequenceNumber: 1, raster: raster(20), qualityScore: 0.9 },
      { evidenceId: 'frame-l', timestamp: 2, sequenceNumber: 2, raster: raster(30), qualityScore: 0.91 },
    ],
    sourceType: 'uvc',
    ...patch,
  }
}

function client(text: string, calls: string[], images: number[]): LlmClient {
  return {
    providerId: 'mock',
    async completeJson(input) {
      calls.push(text)
      images.push(input.images?.length ?? 0)
      return text
    },
  }
}

const observations = JSON.stringify({
  observations: [
    {
      id: 'obs_1',
      feature: 'анэхогенная полость',
      polarity: 'present',
      evidence: [{ evidenceId: 'frame-t' }],
    },
  ],
})

const differential = JSON.stringify({
  differential: [
    {
      id: 'dx_1',
      label: 'увеличенный объём',
      priority: 'consider',
      supportingObservationIds: ['obs_1'],
      contradictingObservationIds: [],
      missingEvidence: [],
      limitations: [],
    },
  ],
})

async function run(patch: Partial<DiagnoseCommand>, brain1Text = observations, brain2Text = differential) {
  const calls: string[] = []
  const images: number[] = []
  const result = await runDiagnosticPipeline(command(patch), {
    brain1: client(brain1Text, calls, images),
    brain2: client(brain2Text, calls, images),
    brain1Model: 'brain-1',
    brain2Model: 'brain-2',
    now: () => '2026-09-27T00:00:00.000Z',
  })
  return { result, calls, images }
}

describe('диагностический конвейер', () => {
  it('собирает валидный результат и не вызывает Doctor Opus', async () => {
    const { result, calls, images } = await run(
      {},
      observations,
      JSON.stringify({
        report: 'В осмотренной области анэхогенная полость.',
        differential: JSON.parse(differential).differential,
      }),
    )
    expect(result.outcome).toBe('hypotheses_available')
    expect(result.differential[0]?.supportingObservationIds).toEqual(['obs_1'])
    expect(result.sonographerReport).toBe('В осмотренной области анэхогенная полость.')
    expect(result.modelProvenance?.model).toBe('brain-1 + brain-2')
    expect(calls).toHaveLength(2)
    expect(images).toEqual([2, 2])
  })

  it('не показывает протокол, если в нём новый размер', async () => {
    const { result } = await run(
      {},
      observations,
      JSON.stringify({
        report: 'Очаг 12 мм.',
        differential: JSON.parse(differential).differential,
      }),
    )
    expect(result.sonographerReport).toBeUndefined()
    expect(result.differential).toHaveLength(1)
  })

  it('блокирует гипотезу без evidence, а не пропускает её с предупреждением', async () => {
    const { result } = await run(
      {},
      observations,
      JSON.stringify({
        differential: [
          {
            id: 'dx_bad',
            label: 'необоснованно',
            priority: 'most_compatible',
            supportingObservationIds: [],
            contradictingObservationIds: [],
            missingEvidence: [],
            limitations: [],
          },
        ],
      }),
    )
    expect(result.differential).toHaveLength(0)
    expect(result.outcome).toBe('insufficient_evidence')
  })

  it('не вызывает модель, если качество ниже порога', async () => {
    const { result, calls } = await run({
      frames: [{ evidenceId: 'frame-t', timestamp: 1, sequenceNumber: 1, raster: raster(), qualityScore: 0.2 }],
    })
    expect(calls).toHaveLength(0)
    expect(result.outcome).toBe('insufficient_evidence')
    expect(result.whyCannotAssess?.join(' ')).toMatch(/порога/)
  })

  it('при неполном протоколе всё же строит гипотезу низкой достоверности', async () => {
    const { calls, result } = await run({
      views: [{ name: 'transverse', evidenceIds: ['frame-t'], operatorConfirmed: true, qualityScore: 0.9 }],
    })
    expect(calls).toHaveLength(2)
    expect(result.outcome).toBe('low_confidence_hypothesis')
    expect(result.differential).toHaveLength(1)
    expect(result.qualityLimitations?.join(' ')).toMatch(/longitudinal/)
  })

  it('анонимизирует верхнюю полосу до модели', () => {
    const frame = command().frames[0]
    frame.raster.data[0] = 255
    const [prepared] = prepareFramesForModel([frame])
    expect(prepared?.raster.data[0]).toBe(0)
  })

  it('не передаёт синтетический источник наружу', () => {
    const gate = assertForwardable(
      {
        schemaVersion: '1.0',
        studyId: 'study-1',
        question: 'вопрос',
        views: [],
        observations: [],
        differential: [],
        outcome: 'insufficient_evidence',
        acquisitionRequests: [],
        formulaSource: 'published-literature',
        clinicallyValidated: false,
      },
      'synthetic',
    )
    expect(gate.ok).toBe(false)
  })
})
