import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'
import { bytesToBase64 } from '@/lib/image/base64'
import { encodePng } from '@/lib/image/png-encode'
import { extractJson } from '@/lib/llm-pipeline/json-text'
import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import type { VisionFrameInput, VisionFrameResponse, VisionObservationDraft } from '@/lib/vision-engine/types'
import type { AnatomyRequest, PlaneRequest, VisionClipRequest, VisionProvider } from '@/lib/vision-engine/providers/vision-provider'

function readPrompt(name: string): string {
  const path = join(dirname(fileURLToPath(import.meta.url)), `../../../prompts/vision/${name}.prompt.md`)
  return readFileSync(path, 'utf8')
}

export function loadObservationPrompt(): string {
  return readPrompt('observation')
}

export function loadAnatomyPrompt(): string {
  return readPrompt('anatomy')
}

export function loadPlanePrompt(): string {
  return readPrompt('plane')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function normalizeVisionResponse(value: unknown, allowedFrameIds: readonly string[]): VisionFrameResponse {
  const record = asRecord(value)
  const uncertainties = new Set<string>()
  if (!record) return { schemaVersion: 'vision-1.0', observations: [], uncertainties: ['invalid_json'] }
  if ('diagnosis' in record || 'differential' in record) uncertainties.add('diagnosis_withheld')
  const raw = Array.isArray(record.observations) ? record.observations : []
  const observations: VisionObservationDraft[] = []
  for (const item of raw) {
    const row = asRecord(item)
    if (!row) continue
    const confidence = typeof row.confidence === 'number' ? row.confidence : Number.NaN
    const frameIds = Array.isArray(row.frameIds) ? row.frameIds.filter((id): id is string => typeof id === 'string' && allowedFrameIds.includes(id)) : []
    const label = typeof row.label === 'string' ? row.label : ''
    if (!label || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || frameIds.length === 0) {
      uncertainties.add('observation_dropped')
      continue
    }
    if (typeof row.value === 'number' || row.unit === 'mm' || row.unit === 'ml') {
      uncertainties.add('measurement_withheld')
      continue
    }
    const type = row.type === 'anatomy' || row.type === 'plane' ? row.type : 'perception'
    observations.push({
      id: typeof row.id === 'string' ? row.id : `obs_${observations.length + 1}`,
      type,
      label,
      confidence,
      frameIds,
      timestamp: typeof row.timestamp === 'number' ? row.timestamp : 0,
      uncertaintyReason: typeof row.uncertaintyReason === 'string' ? row.uncertaintyReason : null,
    })
  }
  if (Array.isArray(record.uncertainties)) {
    for (const item of record.uncertainties) {
      if (typeof item === 'string') uncertainties.add(item)
    }
  }
  return { schemaVersion: 'vision-1.0', observations, uncertainties: [...uncertainties] }
}

export function createGeminiVisionProvider(options: {
  client: LlmClient
  model: string
  prompt?: string
}): VisionProvider {
  const promptFor = (task: string) => {
    if (options.prompt) return options.prompt
    if (task === 'anatomy') return loadAnatomyPrompt()
    if (task === 'plane') return loadPlanePrompt()
    return loadObservationPrompt()
  }
  async function ask(frames: VisionFrameInput[], samplingFps: number, task: string): Promise<VisionFrameResponse> {
    const images = frames.map((frame) => ({
      mimeType: 'image/png' as const,
      base64: bytesToBase64(encodePng(anonymizeRaster(frame.raster))),
    }))
    const user = JSON.stringify({
      task,
      samplingFps,
      frames: frames.map((frame) => ({ id: frame.id, timestamp: frame.timestamp })),
    })
    try {
      const text = await options.client.completeJson({
        model: options.model,
        system: promptFor(task),
        user,
        images,
      })
      return normalizeVisionResponse(extractJson(text), frames.map((frame) => frame.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'сбой провайдера'
      if (message.includes('JSON')) {
        return { schemaVersion: 'vision-1.0', observations: [], uncertainties: ['invalid_json'] }
      }
      throw new Error(`Vision provider: ${message}`)
    }
  }
  return {
    id: options.client.providerId,
    model: options.model,
    analyzeFrames: (frames, samplingFps) => ask(frames, samplingFps, 'observe'),
    analyzeClip: (request: VisionClipRequest) => ask(request.frames, request.samplingFps, 'clip'),
    identifyAnatomy: (request: AnatomyRequest) => ask(request.frames, request.samplingFps, 'anatomy'),
    identifyPlane: (request: PlaneRequest) => ask(request.frames, request.samplingFps, 'plane'),
    extractObservations: (frames, samplingFps) => ask(frames, samplingFps, 'observe'),
  }
}
