import type { QualityScore, QualityScorer, Raster } from '@/lib/domain/types'
import { clamp01 } from '@/lib/domain/number'
import { QUALITY_WEIGHTS } from '@/lib/quality/constants'
import { rasterToGray } from '@/lib/quality/gray'

const SHARPNESS_VARIANCE_SCALE = 0.02
const STABILITY_MAD_SCALE = 0.12

function emptyScore(): QualityScore {
  return { sharpness: 0, brightness: 0, stability: 0, coverage: 0, qualityScore: 0 }
}

function scoreSharpness(gray: Float32Array, width: number, height: number): number {
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const lap =
        gray[index - width] +
        gray[index + width] +
        gray[index - 1] +
        gray[index + 1] -
        4 * gray[index]
      sum += lap
      sumSq += lap * lap
      count += 1
    }
  }
  if (count === 0) return 0
  const mean = sum / count
  const variance = Math.max(0, sumSq / count - mean * mean)
  return clamp01(variance / SHARPNESS_VARIANCE_SCALE)
}

function scoreBrightness(gray: Float32Array): number {
  const total = gray.length
  if (total === 0) return 0
  let tissueSum = 0
  let tissueCount = 0
  let clippedHigh = 0
  for (let i = 0; i < total; i += 1) {
    const value = gray[i]
    if (value > 0.96) clippedHigh += 1
    if (value >= 0.04) {
      tissueSum += value
      tissueCount += 1
    }
  }
  if (tissueCount < total * 0.05) return 0
  const tissueMean = tissueSum / tissueCount
  let exposure = 1
  if (tissueMean < 0.18) exposure = tissueMean / 0.18
  else if (tissueMean > 0.82) exposure = Math.max(0, (1 - tissueMean) / 0.18)
  const clipScore = 1 - Math.min(1, clippedHigh / total / 0.08)
  return clamp01(exposure * 0.75 + clipScore * 0.25)
}

function scoreStability(gray: Float32Array, prevGray: Float32Array | null): number {
  if (!prevGray || prevGray.length !== gray.length) return 1
  let diff = 0
  for (let i = 0; i < gray.length; i += 1) diff += Math.abs(gray[i] - prevGray[i])
  return clamp01(1 - diff / gray.length / STABILITY_MAD_SCALE)
}

function scoreCoverage(gray: Float32Array): number {
  if (gray.length === 0) return 0
  let filled = 0
  for (let i = 0; i < gray.length; i += 1) {
    const value = gray[i]
    if (value >= 0.06 && value <= 0.98) filled += 1
  }
  return clamp01(filled / gray.length)
}

export const heuristicQualityScorer: QualityScorer = {
  score(gray, width, height, prevGray) {
    if (width < 3 || height < 3 || gray.length !== width * height) return emptyScore()
    const sharpness = scoreSharpness(gray, width, height)
    const brightness = scoreBrightness(gray)
    const stability = scoreStability(gray, prevGray)
    const coverage = scoreCoverage(gray)
    const qualityScore = clamp01(
      sharpness * QUALITY_WEIGHTS.sharpness +
        brightness * QUALITY_WEIGHTS.brightness +
        stability * QUALITY_WEIGHTS.stability +
        coverage * QUALITY_WEIGHTS.coverage,
    )
    return { sharpness, brightness, stability, coverage, qualityScore }
  },
}

export function scoreRaster(raster: Raster, previous: Raster | null): QualityScore {
  const gray = rasterToGray(raster)
  const prevGray = previous ? rasterToGray(previous) : null
  return heuristicQualityScorer.score(gray, raster.width, raster.height, prevGray)
}
