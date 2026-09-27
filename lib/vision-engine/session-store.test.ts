import { describe, expect, it } from 'vitest'
import type { QualityScorer } from '@/lib/domain/types'
import { grayToRaster } from '@/lib/quality/gray'
import { frameFromRgba } from '@/lib/vision-engine/frame-codec'
import { visionGuidance } from '@/lib/vision-engine/guidance'
import { bytesToBase64 } from '@/lib/image/base64'
import { clipForSession, ingestVisionFrame, openVisionSession, resetVisionSessions } from '@/lib/vision-engine/session-store'
import { VisionEngine } from '@/lib/vision-engine/vision-engine'

const scorer: QualityScorer = {
  score: () => ({ sharpness: 0.9, brightness: 0.5, stability: 0.2, coverage: 0.8, qualityScore: 0.9 }),
}

describe('сессия зрения', () => {
  it('принимает кадр без облака и не называет это нормой', async () => {
    resetVisionSessions()
    const raster = grayToRaster(new Float32Array([0.2, 0.4, 0.6, 0.8]), 2, 2)
    const encoded = frameFromRgba({
      sequenceNumber: 1,
      timestamp: 0,
      width: 2,
      height: 2,
      rgbaBase64: bytesToBase64(raster.data),
    })
    expect(encoded.imageData.width).toBe(2)
    expect(() => frameFromRgba({ sequenceNumber: 1, timestamp: 0, width: 2, height: 2, rgbaBase64: 'AAAA' })).toThrow(/битый/)
    const session = openVisionSession({
      id: 's1',
      studyId: 'study',
      moduleId: 'thyroid',
      engine: new VisionEngine(scorer, null, { minStableMs: 0, fastLoopFps: 30 }),
      cloudNote: 'облако не настроено',
    })
    const result = await ingestVisionFrame({
      sessionId: session.id,
      frame: encoded,
      confirmedViews: ['right-lobe'],
    })
    expect(result.status).toBe('disabled')
    expect(result.panel.anatomy).toBeNull()
    expect(result.panel.protocolDone).toBe(1)
    expect(result.panel.protocolTotal).toBe(2)
    expect(result.panel.uncertainty).toMatch(/облако/)
    expect(result.panel.guidance).toBe('high_motion')
    expect(visionGuidance({ quality: 0.9, motion: 0.1, tracking: 'stable', anatomy: null, plane: null, missingView: 'left-lobe' })).toBe('turn_for_view')
    expect(clipForSession(session.id, -1000, 1000)?.frameIds).toEqual(['frame-1'])
  })
})
