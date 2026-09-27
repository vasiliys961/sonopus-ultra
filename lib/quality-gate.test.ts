import { describe, expect, it } from 'vitest'
import type { Raster } from '@/lib/domain/types'
import { AUTO_CAPTURE_HOLD_MS, AUTO_CAPTURE_SCORE, QUALITY_WEIGHTS, heuristicQualityScorer, scoreRaster, technicalHint } from '@/lib/quality-gate'
import { QualityStreakTracker } from '@/lib/quality/quality-streak'
import { grayToRaster } from '@/lib/quality/gray'

function solid(value: number, width = 32, height = 24): Float32Array {
  return new Float32Array(width * height).fill(value)
}

function bars(width = 32, height = 24): Float32Array {
  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) gray[y * width + x] = x % 2 === 0 ? 0.12 : 0.88
  }
  return gray
}

describe('Quality Gate', () => {
  it('держит веса в сумме 1 и порог автозахвата 0.75', () => {
    const sum = QUALITY_WEIGHTS.sharpness + QUALITY_WEIGHTS.brightness + QUALITY_WEIGHTS.stability + QUALITY_WEIGHTS.coverage
    expect(sum).toBeCloseTo(1)
    expect(AUTO_CAPTURE_SCORE).toBe(0.75)
    expect(AUTO_CAPTURE_HOLD_MS).toBe(1500)
  })

  it('оценивает резкость полос выше однородного поля', () => {
    const sharp = heuristicQualityScorer.score(bars(), 32, 24, null)
    const flat = heuristicQualityScorer.score(solid(0.45), 32, 24, null)
    expect(sharp.sharpness).toBeGreaterThan(flat.sharpness)
    expect(flat.sharpness).toBe(0)
  })

  it('считает чёрный кадр темнее среднего серого', () => {
    const black = heuristicQualityScorer.score(solid(0), 32, 24, null)
    const mid = heuristicQualityScorer.score(solid(0.45), 32, 24, null)
    const white = heuristicQualityScorer.score(solid(1), 32, 24, null)
    expect(black.brightness).toBe(0)
    expect(white.brightness).toBeLessThan(mid.brightness)
    expect(mid.brightness).toBeGreaterThan(0.8)
  })

  it('снижает стабильность при сильном отличии кадров', () => {
    const current = solid(0.2)
    const same = heuristicQualityScorer.score(current, 32, 24, solid(0.2))
    const moved = heuristicQualityScorer.score(current, 32, 24, solid(0.9))
    expect(same.stability).toBe(1)
    expect(moved.stability).toBeLessThan(0.2)
  })

  it('не наказывает первый кадр и кадр другого размера', () => {
    const score = heuristicQualityScorer.score(solid(0.4), 32, 24, new Float32Array(4))
    expect(score.stability).toBe(1)
  })

  it('отличает заполненный кадр от чёрного', () => {
    const filled = heuristicQualityScorer.score(solid(0.4), 32, 24, null)
    const empty = heuristicQualityScorer.score(solid(0), 32, 24, null)
    expect(filled.coverage).toBeGreaterThan(0.9)
    expect(empty.coverage).toBe(0)
  })

  it('держит каждую оценку в диапазоне 0..1', () => {
    const score = heuristicQualityScorer.score(bars(), 32, 24, bars())
    for (const value of Object.values(score)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('возвращает нули на пустом и слишком маленьком кадре', () => {
    expect(heuristicQualityScorer.score(new Float32Array(0), 0, 0, null).qualityScore).toBe(0)
    expect(heuristicQualityScorer.score(new Float32Array(4), 2, 2, null).qualityScore).toBe(0)
  })

  it('совпадает при оценке растра и серого массива', () => {
    const gray = solid(0.4)
    const raster: Raster = grayToRaster(gray, 32, 24)
    const fromRaster = scoreRaster(raster, null)
    const direct = heuristicQualityScorer.score(gray, 32, 24, null)
    expect(fromRaster.qualityScore).toBeCloseTo(direct.qualityScore, 5)
  })

  it('не превращает техническую подсказку в анатомическую', () => {
    const hint = technicalHint({ sharpness: 0.1, brightness: 0.8, stability: 0.8, coverage: 0.8, qualityScore: 0.4 })
    expect(hint).toBe('Кадр нерезкий.')
    expect(hint.toLowerCase()).not.toMatch(/угол|глубин|орган|датчик/)
  })

  it('сообщает о движении, когда нестабильность хуже остальных', () => {
    expect(technicalHint({ sharpness: 0.9, brightness: 0.9, stability: 0.05, coverage: 0.9, qualityScore: 0.4 })).toBe(
      'Слишком резкое движение.',
    )
  })

  it('открывает автозахват только после 1.5 с над порогом', () => {
    const streak = new QualityStreakTracker()
    expect(streak.push(0.8, 0).ready).toBe(false)
    expect(streak.push(0.9, 1499).ready).toBe(false)
    expect(streak.push(0.76, 1500)).toEqual({ holding: true, heldMs: 1500, ready: true })
  })

  it('сбрасывает серию, когда качество падает', () => {
    const streak = new QualityStreakTracker()
    streak.push(0.9, 0)
    expect(streak.push(0.2, 400)).toEqual({ holding: false, heldMs: 0, ready: false })
    expect(streak.push(0.9, 500).heldMs).toBe(0)
  })

  it('сбрасывает серию при скачке времени назад и при NaN', () => {
    const streak = new QualityStreakTracker()
    streak.push(0.9, 1000)
    expect(streak.push(0.9, 10).heldMs).toBe(0)
    expect(streak.push(Number.NaN, 20).ready).toBe(false)
  })

  it('не считает кадр готовым ровно на границе порога снизу', () => {
    const streak = new QualityStreakTracker()
    expect(streak.push(0.749, 0).holding).toBe(false)
    expect(streak.push(0.75, 0).holding).toBe(true)
  })
})
