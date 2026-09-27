import type { QualityScore, QualityScorer } from '@/lib/domain/types'
import { clamp01 } from '@/lib/domain/number'
import { QUALITY_WEIGHTS } from '@/lib/quality/constants'
import { heuristicQualityScorer } from '@/lib/quality/heuristic-quality-scorer'

export interface QualityModel {
  id: string
  predict(
    gray: Float32Array,
    width: number,
    height: number,
    prevGray: Float32Array | null,
  ): Omit<QualityScore, 'qualityScore'>
}

export function createMlQualityScorer(model: QualityModel): QualityScorer {
  return {
    score(gray, width, height, prevGray) {
      const predicted = model.predict(gray, width, height, prevGray)
      const sharpness = clamp01(predicted.sharpness)
      const brightness = clamp01(predicted.brightness)
      const stability = clamp01(predicted.stability)
      const coverage = clamp01(predicted.coverage)
      const qualityScore = clamp01(
        QUALITY_WEIGHTS.sharpness * sharpness +
          QUALITY_WEIGHTS.brightness * brightness +
          QUALITY_WEIGHTS.stability * stability +
          QUALITY_WEIGHTS.coverage * coverage,
      )
      return { sharpness, brightness, stability, coverage, qualityScore }
    },
  }
}

let registeredModel: QualityModel | null = null

export function registerQualityModel(model: QualityModel | null): void {
  registeredModel = model
}

export function activeQualityScorer(
  env: { SONO_QUALITY_SCORER?: string } = { SONO_QUALITY_SCORER: process.env.SONO_QUALITY_SCORER },
): QualityScorer {
  if (env.SONO_QUALITY_SCORER !== 'ml') return heuristicQualityScorer
  if (!registeredModel) throw new Error('ML-модель качества не подключена')
  return createMlQualityScorer(registeredModel)
}
