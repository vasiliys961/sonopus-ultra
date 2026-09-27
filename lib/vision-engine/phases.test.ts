import { describe, expect, it, vi } from 'vitest'
import { compareProviders } from '@/benchmark/vision/runner'
import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import type { QualityScore, QualityScorer, UltrasoundFrame } from '@/lib/domain/types'
import { grayToRaster } from '@/lib/quality/gray'
import { readAnatomy } from '@/lib/vision-engine/anatomy/anatomy-detector'
import { findContradictions } from '@/lib/vision-engine/evidence/contradictions'
import { toBrain2Context } from '@/lib/vision-engine/evidence/brain2-adapter'
import { buildEvidencePack } from '@/lib/vision-engine/evidence/evidence-pack'
import { runExperimental3d } from '@/lib/vision-engine/experimental/sensorless-3d'
import { reviewCandidate } from '@/lib/vision-engine/measurement/candidates'
import { readPlane } from '@/lib/vision-engine/plane/plane-detector'
import { protocolState } from '@/lib/vision-engine/protocol/protocol-state'
import { createMockVisionProvider } from '@/lib/vision-engine/providers/mock-vision-provider'
import { createQwenVisionProvider } from '@/lib/vision-engine/providers/qwen-vision-provider'
import { createVisionRouter } from '@/lib/vision-engine/providers/vision-router'
import { poseEstimate } from '@/lib/spatial-reconstruction/pose-network/pose-model'
import { TemporalTracker } from '@/lib/vision-engine/tracking/temporal-tracker'
import type { VisionFrameResponse } from '@/lib/vision-engine/types'
import { thyroidModule } from '@/lib/ultrasound-modules/thyroid/thyroid-module'
import { VisionEngine } from '@/lib/vision-engine/vision-engine'

function scoreOf(qualityScore: number): QualityScore {
  return { sharpness: qualityScore, brightness: 0.5, stability: 0.9, coverage: 0.7, qualityScore }
}

function scorerReturning(value: number): QualityScorer {
  return { score: () => scoreOf(value) }
}

function frame(sequenceNumber: number, timestamp: number): UltrasoundFrame {
  return { imageData: grayToRaster(new Float32Array([0.4, 0.4, 0.4, 0.4]), 2, 2), timestamp, sequenceNumber }
}

function response(label: string, type: 'anatomy' | 'plane' | 'perception', frameId = 'frame-1'): VisionFrameResponse {
  return {
    schemaVersion: 'vision-1.0',
    observations: [{ id: 'obs_1', type, label, confidence: 0.9, frameIds: [frameId], timestamp: 0, uncertaintyReason: null }],
    uncertainties: [],
  }
}

describe('vision engine, фазы 2–6', () => {
  it('читает орган и плоскость только из известного словаря', () => {
    expect(readAnatomy(response('thyroid_right_lobe', 'anatomy'))).toMatchObject({ organ: 'thyroid', laterality: 'right', region: 'right_lobe' })
    expect(readAnatomy(response('demo_field', 'perception'))).toBeNull()
    expect(readPlane(response('longitudinal', 'plane'))?.type).toBe('longitudinal')
    expect(readPlane(response('demo_field', 'perception'))).toBeNull()
  })

  it('держит одну и ту же метку и теряет её, когда кадр пуст', () => {
    const tracker = new TemporalTracker()
    const anatomy = readAnatomy(response('bladder', 'anatomy'))
    expect(tracker.push({ at: 0, anatomy, plane: null }).state).toBe('tracking')
    expect(tracker.push({ at: 1000, anatomy, plane: null }, 1000).state).toBe('stable')
    expect(tracker.push({ at: 1200, anatomy: null, plane: null }).state).toBe('lost')
  })

  it('считает полноту по обязательным проекциям модуля', () => {
    const state = protocolState(thyroidModule, ['right-lobe'])
    expect(state.completed).toEqual(['right-lobe'])
    expect(state.missing).toEqual(['left-lobe'])
    expect(state.completeness).toBe(0.5)
  })

  it('без шкалы оставляет миллиметры кандидатом', () => {
    const reviewed = reviewCandidate({
      structure: 'bladder',
      value: 40,
      unit: 'mm',
      confidence: 0.8,
      sourceFrameIds: ['frame-1'],
      calibration: { status: 'unavailable', reason: 'шкала не подтверждена' },
    })
    expect(reviewed.validationStatus).toBe('candidate')
    expect(reviewed.value).toBeUndefined()
    const scaled = reviewCandidate({
      structure: 'bladder',
      value: 40,
      unit: 'mm',
      confidence: 0.8,
      sourceFrameIds: ['frame-1'],
      calibration: { status: 'verified', mmPerPixel: 0.1, source: 'dicom-pixel-spacing' },
    })
    expect(scaled.validationStatus).toBe('validated')
    expect(scaled.value).toBe(40)
  })

  it('помечает спор стороны и спор размера', () => {
    const right = readAnatomy(response('thyroid_right_lobe', 'anatomy'))
    const left = readAnatomy(response('thyroid_left_lobe', 'anatomy', 'frame-2'))
    expect(right && left && findContradictions([right, left], [])).toEqual([{ code: 'possible_tracking_error', detail: 'thyroid' }])
    expect(findContradictions([], [{ structure: 'nodule', value: 8 }, { structure: 'nodule', value: 13 }])).toEqual([
      { code: 'possible_tracking_error', detail: 'nodule' },
    ])
  })

  it('не отдаёт Brain 2 пустой пакет и не называет это нормой', () => {
    const pack = buildEvidencePack({
      studyId: 'study-1',
      anatomy: [],
      planes: [],
      measurements: [],
      observations: [],
      selectedFrames: [],
      selectedClips: [],
      protocol: { protocolId: 'thyroid', completed: [], missing: ['right-lobe', 'left-lobe'], completeness: 0 },
      uncertainties: [],
      contradictions: [],
      generatedAt: '2026-09-27T00:00:00.000Z',
    })
    const context = toBrain2Context(pack)
    expect(context.ready).toBe(false)
    expect(context.reason).toBe('insufficient_evidence')
    expect(JSON.stringify(context)).not.toMatch(/normal|норм/)
  })

  it('повторяет выбранные кадры из кэша и собирает пакет', async () => {
    const provider = createMockVisionProvider()
    const analyze = vi.spyOn(provider, 'analyzeFrames')
    const engine = new VisionEngine(scorerReturning(0.9), provider, {
      enableCloudVision: true,
      minStableMs: 0,
      fastLoopFps: 30,
      visionLoopFps: 30,
      debug: true,
    })
    engine.ingest(frame(1, 0))
    const first = await engine.assemble({ studyId: 'study-1', module: thyroidModule, generatedAt: '2026-09-27T00:00:00.000Z' })
    const second = await engine.analyzeSelected()
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(second.status).toBe('completed')
    expect(first.pack.observations[0]?.uncertaintyReason).toBe('mock_provider')
    expect(first.pack.measurements).toEqual([])
    expect(first.brain2.ready).toBe(true)
    expect(first.brain2.request?.bodyRegion).toBeUndefined()
    expect(first.brain2.request?.observations[0]?.polarity).toBe('uncertain')
    expect(engine.events).toContain('EVIDENCE_PACK_CREATED')
  })

  it('после таймаута берёт следующий провайдер', async () => {
    const failing = createMockVisionProvider()
    vi.spyOn(failing, 'analyzeFrames').mockRejectedValue(new Error('timeout'))
    const router = createVisionRouter([failing, createMockVisionProvider()])
    const response = await router.analyzeFrames([{ id: 'frame-1', timestamp: 0, raster: frame(1, 0).imageData }], 2)
    expect(response.observations[0]?.label).toBe('demo_field')
  })

  it('сравнивает провайдеры как согласие восприятия, не как клиническую точность', async () => {
    const client: LlmClient = {
      providerId: 'openrouter',
      completeJson: async () => JSON.stringify({
        schemaVersion: 'vision-1.0',
        observations: [{ id: 'obs_1', type: 'perception', label: 'demo_field', confidence: 0.4, frameIds: ['frame-1'], timestamp: 0, uncertaintyReason: null }],
        uncertainties: [],
      }),
    }
    const qwen = createQwenVisionProvider({ client, model: 'qwen3-vl', prompt: 'json' })
    const report = await compareProviders([qwen, createMockVisionProvider()], [{
      id: 'case-1',
      frames: [{ id: 'frame-1', timestamp: 0, raster: frame(1, 0).imageData }],
      expectedLabel: 'demo_field',
    }])
    expect(qwen.id).toBe('qwen')
    expect(report.clinicallyValidated).toBe(false)
    expect(report.kind).toBe('perception_agreement')
    expect(report.rows.every((row) => row.agreed === 1)).toBe(true)
  })

  it('не строит траекторию, пока экспериментальный режим выключен, и не выдумывает позу', () => {
    const plane = { gray: new Float32Array([1, 1, 1, 1]), width: 2, height: 2 }
    expect(runExperimental3d(false, [plane, plane], null).status).toBe('disabled')
    const missing = runExperimental3d(true, [plane, plane], null)
    expect(missing.status).toBe('degraded')
    expect(missing.trajectory).toEqual([])
    expect(missing.clinicallyValidated).toBe(false)
    const ready = runExperimental3d(true, [plane, plane], {
      id: 'stub',
      domain: 'forearm-tus-rec',
      predictPair: () => poseEstimate(1, [0, 0, 1], [0, 0, 0], null),
    })
    expect(ready.status).toBe('completed')
    expect(ready.trajectory[1]?.translationMm[2]).toBeCloseTo(1)
    expect(ready.clinicallyValidated).toBe(false)
  })
})
