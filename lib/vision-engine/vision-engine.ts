import type { CalibrationState, OrganModule, QualityScorer, UltrasoundFrame } from '@/lib/domain/types'
import { rasterToGray } from '@/lib/quality/gray'
import { QualityStreakTracker } from '@/lib/quality/quality-streak'
import { readAnatomy, type AnatomyObservation } from '@/lib/vision-engine/anatomy/anatomy-detector'
import { visionConfig, type VisionEngineConfig } from '@/lib/vision-engine/config'
import { toBrain2Context, type Brain2EvidenceContext } from '@/lib/vision-engine/evidence/brain2-adapter'
import { findContradictions } from '@/lib/vision-engine/evidence/contradictions'
import { buildEvidencePack, type EvidencePack } from '@/lib/vision-engine/evidence/evidence-pack'
import { FrameBuffer, type BufferedFrame } from '@/lib/vision-engine/frame-buffer'
import { selectKeyFrames } from '@/lib/vision-engine/key-frame-selector'
import { reviewCandidate, type MeasurementCandidate } from '@/lib/vision-engine/measurement/candidates'
import { readPlane } from '@/lib/vision-engine/plane/plane-detector'
import { protocolState } from '@/lib/vision-engine/protocol/protocol-state'
import type { VisionProvider } from '@/lib/vision-engine/providers/vision-provider'
import { selectClip } from '@/lib/vision-engine/selection/clip-selector'
import { TemporalTracker } from '@/lib/vision-engine/tracking/temporal-tracker'
import { toFrameMetrics, type FrameMetrics, type VisionCallTelemetry, type VisionFrameResponse } from '@/lib/vision-engine/types'

export interface IngestResult {
  skipped: boolean
  accepted: boolean
  metrics: FrameMetrics | null
}

export interface VisionAnalysis {
  selected: BufferedFrame[]
  response: VisionFrameResponse | null
  status: 'disabled' | 'below_quality' | 'rate_limited' | 'completed' | 'degraded'
  telemetry: VisionCallTelemetry | null
  error?: string
}

export class VisionEngine {
  private readonly config: VisionEngineConfig
  private readonly buffer = new FrameBuffer()
  private readonly streak: QualityStreakTracker
  private previousGray: Float32Array | null = null
  private lastSampleAt: number | null = null
  private lastVisionAt: number | null = null
  private visionCalls = 0
  private visionWindowStartedAt: number | null = null
  private readonly cache = new Map<string, VisionFrameResponse>()
  private readonly tracker = new TemporalTracker()
  readonly events: string[] = []

  constructor(
    private readonly scorer: QualityScorer,
    private readonly provider: VisionProvider | null,
    overrides: Partial<VisionEngineConfig> = {},
  ) {
    this.config = visionConfig(overrides)
    this.streak = new QualityStreakTracker(this.config.minQualityScore, this.config.minStableMs)
  }

  ingest(frame: UltrasoundFrame): IngestResult {
    const minGap = 1000 / this.config.fastLoopFps
    if (this.lastSampleAt !== null && frame.timestamp - this.lastSampleAt < minGap) {
      return { skipped: true, accepted: false, metrics: null }
    }
    this.note('FRAME_RECEIVED')
    this.lastSampleAt = frame.timestamp
    const gray = rasterToGray(frame.imageData)
    const score = this.scorer.score(gray, frame.imageData.width, frame.imageData.height, this.previousGray)
    this.previousGray = gray
    const metrics = toFrameMetrics(frame.timestamp, score)
    const hold = this.streak.push(score.qualityScore, frame.timestamp)
    const accepted = hold.ready
    if (!accepted) this.note('QUALITY_REJECTED')
    if (accepted) {
      this.buffer.push({
        id: `frame-${frame.sequenceNumber}`,
        frame,
        metrics,
      })
    }
    return { skipped: false, accepted, metrics }
  }

  candidates(): readonly BufferedFrame[] {
    return this.buffer.all()
  }

  async analyzeSelected(): Promise<VisionAnalysis> {
    const selected = selectKeyFrames(this.buffer.all(), {
      limit: 3,
      minGapMs: 1000 / this.config.visionLoopFps,
    })
    const provider = this.provider
    if (!provider || !this.config.enableCloudVision) {
      return { selected, response: null, status: 'disabled', telemetry: null }
    }
    if (selected.length === 0) {
      return { selected, response: null, status: 'below_quality', telemetry: null }
    }
    const cacheKey = selected.map((item) => item.id).join('|')
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return {
        selected,
        response: cached,
        status: 'completed',
        telemetry: { provider: provider.id, model: provider.model, task: 'observe', latencyMs: 0, inputFrames: selected.length },
      }
    }
    const now = selected[selected.length - 1]?.metrics.timestamp ?? Date.now()
    if (this.visionWindowStartedAt === null || now - this.visionWindowStartedAt >= 60_000) {
      this.visionWindowStartedAt = now
      this.visionCalls = 0
    }
    if (this.visionCalls >= this.config.maxVisionCallsPerMinute) {
      return { selected, response: null, status: 'rate_limited', telemetry: null }
    }
    const minVisionGap = 1000 / this.config.visionLoopFps
    if (this.lastVisionAt !== null && now - this.lastVisionAt < minVisionGap) {
      return { selected, response: null, status: 'rate_limited', telemetry: null }
    }
    const started = Date.now()
    this.note('VISION_REQUEST')
    try {
      const response = await provider.analyzeFrames(
        selected.map((item) => ({ id: item.id, timestamp: item.metrics.timestamp, raster: item.frame.imageData })),
        this.config.visionLoopFps,
      )
      this.lastVisionAt = now
      this.visionCalls += 1
      this.cache.set(cacheKey, response)
      this.note('VISION_RESPONSE')
      return {
        selected,
        response,
        status: 'completed',
        telemetry: {
          provider: provider.id,
          model: provider.model,
          task: 'observe',
          latencyMs: Date.now() - started,
          inputFrames: selected.length,
        },
      }
    } catch (error) {
      return {
        selected,
        response: null,
        status: 'degraded',
        telemetry: null,
        error: error instanceof Error ? error.message : 'сбой зрения',
      }
    }
  }

  async assemble(input: {
    studyId: string
    module?: Pick<OrganModule, 'id' | 'requiredViews'>
    confirmedViews?: readonly string[]
    calibration?: CalibrationState
    proposed?: Array<{ structure: string; value?: number; unit?: MeasurementCandidate['unit']; confidence: number; sourceFrameIds: string[] }>
    generatedAt?: string
  }): Promise<{ analysis: VisionAnalysis; pack: EvidencePack; brain2: Brain2EvidenceContext; tracking: ReturnType<TemporalTracker['current']> }> {
    const analysis = await this.analyzeSelected()
    const response = analysis.response
    const anatomy = response ? readAnatomy(response) : null
    const plane = response ? readPlane(response) : null
    const at = analysis.selected[analysis.selected.length - 1]?.metrics.timestamp ?? 0
    if (this.config.enableTracking) this.tracker.push({ at, anatomy, plane }, this.config.minStableMs)
    const anatomyList: AnatomyObservation[] = anatomy ? [anatomy] : []
    const planes = plane ? [plane] : []
    const calibration = input.calibration ?? { status: 'unavailable', reason: 'шкала не подтверждена' }
    const measurements = this.config.enableMeasurements
      ? (input.proposed ?? []).map((item) => reviewCandidate({ ...item, calibration }))
      : []
    const rawMeasurements = input.proposed ?? []
    const contradictions = findContradictions(anatomyList, rawMeasurements)
    const protocol = this.config.enableProtocol && input.module
      ? protocolState(input.module, input.confirmedViews ?? [])
      : { protocolId: input.module?.id ?? 'none', completed: [], missing: [...(input.module?.requiredViews ?? [])], completeness: 0 }
    const anchor = analysis.selected[0]
    const pack = buildEvidencePack({
      studyId: input.studyId,
      anatomy: anatomyList,
      planes,
      measurements,
      observations: response?.observations ?? [],
      selectedFrames: analysis.selected.map((item) => ({ id: item.id, timestamp: item.metrics.timestamp, qualityScore: item.metrics.qualityScore })),
      selectedClips: anchor ? [selectClip(anchor, analysis.selected, this.config.visionLoopFps)] : [],
      protocol,
      uncertainties: [...(response?.uncertainties ?? []), ...(analysis.error ? [analysis.error] : [])],
      contradictions,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    })
    if (pack.selectedFrames.length > 0) this.note('EVIDENCE_PACK_CREATED')
    return { analysis, pack, brain2: toBrain2Context(pack), tracking: this.tracker.current() }
  }

  private note(name: string): void {
    if (this.config.debug) this.events.push(name)
  }
}
