import type { QualityScore, Raster } from '@/lib/domain/types'

/** Вид существующего QualityScore. contrast отдельно не считается. motion = 1 − stability. */
export interface FrameMetrics {
  timestamp: number
  sharpness: number
  brightness: number
  stability: number
  coverage: number
  qualityScore: number
  motion: number
}

export function toFrameMetrics(timestamp: number, score: QualityScore): FrameMetrics {
  return {
    timestamp,
    sharpness: score.sharpness,
    brightness: score.brightness,
    stability: score.stability,
    coverage: score.coverage,
    qualityScore: score.qualityScore,
    motion: 1 - score.stability,
  }
}

export interface VisionFrameInput {
  id: string
  timestamp: number
  raster: Raster
}

export interface VisionObservationDraft {
  id: string
  type: 'perception' | 'anatomy' | 'plane'
  label: string
  confidence: number
  frameIds: string[]
  timestamp: number
  uncertaintyReason: string | null
}

export interface VisionFrameResponse {
  schemaVersion: 'vision-1.0'
  observations: VisionObservationDraft[]
  uncertainties: string[]
}

export interface VisionCallTelemetry {
  provider: string
  model: string
  task: string
  latencyMs: number
  inputFrames: number
}

export interface KeyFrameWeights {
  quality: number
  anatomy: number
  plane: number
  novelty: number
  protocol: number
}

export const DEFAULT_KEYFRAME_WEIGHTS: KeyFrameWeights = {
  quality: 0.45,
  anatomy: 0.15,
  plane: 0.15,
  novelty: 0.15,
  protocol: 0.1,
}

export interface KeyFrameScore {
  qualityScore: number
  anatomyScore: number
  planeScore: number
  noveltyScore: number
  protocolValue: number
  finalScore: number
}
