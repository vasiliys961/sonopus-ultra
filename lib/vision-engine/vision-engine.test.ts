import { describe, expect, it, vi } from 'vitest'
import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import type { QualityScore, QualityScorer, UltrasoundFrame } from '@/lib/domain/types'
import { grayToRaster } from '@/lib/quality/gray'
import { scoreKeyFrame, selectKeyFrames } from '@/lib/vision-engine/key-frame-selector'
import { createGeminiVisionProvider, loadObservationPrompt, normalizeVisionResponse } from '@/lib/vision-engine/providers/gemini-vision-provider'
import { createMockVisionProvider } from '@/lib/vision-engine/providers/mock-vision-provider'
import type { BufferedFrame } from '@/lib/vision-engine/frame-buffer'
import { VisionEngine } from '@/lib/vision-engine/vision-engine'

function scoreOf(qualityScore: number): QualityScore {
  return { sharpness: qualityScore, brightness: 0.5, stability: 0.8, coverage: 0.7, qualityScore }
}

function scorerReturning(value: number): QualityScorer {
  return { score: () => scoreOf(value) }
}

function frame(sequenceNumber: number, timestamp: number): UltrasoundFrame {
  const gray = new Float32Array(4)
  gray.fill(0.4)
  return { imageData: grayToRaster(gray, 2, 2), timestamp, sequenceNumber }
}

function buffered(id: string, timestamp: number, qualityScore: number): BufferedFrame {
  return {
    id,
    frame: frame(1, timestamp),
    metrics: {
      timestamp,
      sharpness: qualityScore,
      brightness: 0.5,
      stability: 0.8,
      coverage: 0.7,
      qualityScore,
      motion: 0.2,
    },
  }
}

describe('vision engine, фаза 1', () => {
  it('не вызывает модель, пока качество ниже порога', async () => {
    const provider = createMockVisionProvider()
    const analyze = vi.spyOn(provider, 'analyzeFrames')
    const engine = new VisionEngine(scorerReturning(0.2), provider, { enableCloudVision: true, minStableMs: 0, fastLoopFps: 30 })
    const ingested = engine.ingest(frame(1, 0))
    expect(ingested.accepted).toBe(false)
    const result = await engine.analyzeSelected()
    expect(result.status).toBe('below_quality')
    expect(analyze).not.toHaveBeenCalled()
  })

  it('продолжает работу, если провайдер недоступен', async () => {
    const provider = createMockVisionProvider()
    vi.spyOn(provider, 'analyzeFrames').mockRejectedValue(new Error('timeout'))
    const engine = new VisionEngine(scorerReturning(0.9), provider, { enableCloudVision: true, minStableMs: 0, fastLoopFps: 30, visionLoopFps: 30 })
    engine.ingest(frame(1, 0))
    const result = await engine.analyzeSelected()
    expect(result.status).toBe('degraded')
    expect(result.response).toBeNull()
    expect(result.selected).toHaveLength(1)
    expect(result.error).toMatch(/timeout/)
  })

  it('mock не публикует миллиметры и помечает источник', async () => {
    const response = await createMockVisionProvider().analyzeFrames(
      [{ id: 'frame-1', timestamp: 10, raster: frame(1, 10).imageData }],
      2,
    )
    expect(response.observations[0]?.uncertaintyReason).toBe('mock_provider')
    expect(response.observations[0]?.label).toBe('demo_field')
    expect(JSON.stringify(response)).not.toMatch(/"mm"|"ml"/)
  })

  it('выбирает более качественный кадр и держит дистанцию', () => {
    const frames = [buffered('a', 0, 0.95), buffered('b', 100, 0.8), buffered('c', 2000, 0.9)]
    const picked = selectKeyFrames(frames, { limit: 2, minGapMs: 500 })
    expect(picked.map((item) => item.id)).toEqual(['a', 'c'])
    expect(scoreKeyFrame(frames[0]).finalScore).toBeGreaterThan(scoreKeyFrame(frames[1]).finalScore)
  })

  it('gemini снимает диагноз и нечисловой json, кадр уходит обезличенным', async () => {
    expect(loadObservationPrompt()).toMatch(/не ставь диагноз/)
    expect(normalizeVisionResponse({ diagnosis: 'узел', observations: [] }, ['frame-1']).uncertainties).toContain('diagnosis_withheld')
    expect(normalizeVisionResponse('не json', ['frame-1']).uncertainties).toEqual(['invalid_json'])
    const client: LlmClient = {
      providerId: 'openrouter',
      completeJson: vi.fn(async () => JSON.stringify({
        schemaVersion: 'vision-1.0',
        observations: [{ id: 'obs_1', type: 'perception', label: 'поле', confidence: 0.4, frameIds: ['frame-1'], timestamp: 10, uncertaintyReason: null }],
        uncertainties: [],
      })),
    }
    const provider = createGeminiVisionProvider({ client, model: 'google/gemini-3.8-flash', prompt: 'json only' })
    const raster = frame(1, 10).imageData
    raster.data[0] = 255
    const response = await provider.analyzeFrames([{ id: 'frame-1', timestamp: 10, raster }], 2)
    expect(response.observations[0]?.label).toBe('поле')
    const call = vi.mocked(client.completeJson).mock.calls[0]?.[0]
    expect(call?.model).toBe('google/gemini-3.8-flash')
    expect(call?.user).toMatch(/"samplingFps":2/)
    expect(call?.images?.[0]?.base64).toBeTruthy()
  })

  it('без провайдера быстрый цикл остаётся локальным', async () => {
    const engine = new VisionEngine(scorerReturning(0.9), null, { minStableMs: 0, fastLoopFps: 30 })
    expect(engine.ingest(frame(1, 0)).accepted).toBe(true)
    const result = await engine.analyzeSelected()
    expect(result.status).toBe('disabled')
    expect(result.telemetry).toBeNull()
  })
})
