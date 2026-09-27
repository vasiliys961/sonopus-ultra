import { describe, expect, it } from 'vitest'
import { activeQualityScorer, createMlQualityScorer, registerQualityModel, type QualityModel } from '@/lib/quality/ml-quality-scorer'

const model: QualityModel = {
  id: 'fixture',
  predict: () => ({ sharpness: 1.4, brightness: 0.5, stability: 0.25, coverage: 0 }),
}

describe('ML-оценка качества', () => {
  it('без весов не подменяет эвристику обученной оценкой', () => {
    registerQualityModel(null)
    expect(activeQualityScorer({ SONO_QUALITY_SCORER: 'heuristic' }).score(new Float32Array(16), 4, 4, null).qualityScore).toBeTypeOf('number')
    expect(() => activeQualityScorer({ SONO_QUALITY_SCORER: 'ml' }).score(new Float32Array(16), 4, 4, null)).toThrow(/не подключена/)
  })

  it('собирает общий балл из ответа модели и не выпускает его за 0–1', () => {
    const score = createMlQualityScorer(model).score(new Float32Array(16), 4, 4, null)
    expect(score.sharpness).toBe(1)
    expect(score.coverage).toBe(0)
    expect(score.qualityScore).toBeGreaterThan(0)
    expect(score.qualityScore).toBeLessThanOrEqual(1)
  })
})
