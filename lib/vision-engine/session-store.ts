import type { CalibrationState, UltrasoundFrame } from '@/lib/domain/types'
import { getOrganModule } from '@/lib/ultrasound-modules/registry'
import type { EvidencePack } from '@/lib/vision-engine/evidence/evidence-pack'
import { panelFromPerception, type VisionPanel } from '@/lib/vision-engine/guidance'
import { selectClip, type SelectedClip } from '@/lib/vision-engine/selection/clip-selector'
import type { VisionEngine } from '@/lib/vision-engine/vision-engine'

export interface VisionSession {
  id: string
  studyId: string
  moduleId: string
  engine: VisionEngine
  pack: EvidencePack | null
  panel: VisionPanel | null
  cloudNote: string | null
}

const store = globalThis as typeof globalThis & { __sonoVisionSessions?: Map<string, VisionSession> }
store.__sonoVisionSessions ??= new Map()
const sessions = store.__sonoVisionSessions

export function resetVisionSessions(): void {
  sessions.clear()
}

export function openVisionSession(input: { id: string; studyId: string; moduleId: string; engine: VisionEngine; cloudNote: string | null }): VisionSession {
  const session: VisionSession = {
    id: input.id,
    studyId: input.studyId,
    moduleId: input.moduleId,
    engine: input.engine,
    pack: null,
    panel: null,
    cloudNote: input.cloudNote,
  }
  sessions.set(session.id, session)
  return session
}

export function getVisionSession(id: string): VisionSession | undefined {
  return sessions.get(id)
}

export async function ingestVisionFrame(input: {
  sessionId: string
  frame: UltrasoundFrame
  confirmedViews: readonly string[]
  calibration?: CalibrationState
}): Promise<{ panel: VisionPanel; status: string }> {
  const session = sessions.get(input.sessionId)
  if (!session) throw new Error('сессия зрения не найдена')
  const module = getOrganModule(session.moduleId)
  const ingested = session.engine.ingest(input.frame)
  const assembled = await session.engine.assemble({
    studyId: session.studyId,
    module,
    confirmedViews: input.confirmedViews,
    calibration: input.calibration,
    generatedAt: new Date(0).toISOString(),
  })
  session.pack = assembled.pack
  const missing = assembled.pack.protocol.missing[0] ?? null
  session.panel = panelFromPerception({
    quality: ingested.metrics?.qualityScore ?? null,
    motion: ingested.metrics?.motion ?? 0,
    tracking: assembled.tracking.state,
    pack: assembled.pack,
    protocolDone: assembled.pack.protocol.completed.length,
    protocolTotal: assembled.pack.protocol.completed.length + assembled.pack.protocol.missing.length,
    missingView: missing,
    cloudNote: assembled.analysis.status === 'disabled' ? session.cloudNote : assembled.analysis.error ?? null,
  })
  return { panel: session.panel, status: assembled.analysis.status }
}

export function clipForSession(sessionId: string, startTime: number, endTime: number): SelectedClip | null {
  const session = sessions.get(sessionId)
  if (!session) throw new Error('сессия зрения не найдена')
  const frames = session.engine.candidates().filter((item) => item.metrics.timestamp >= startTime && item.metrics.timestamp <= endTime)
  const anchor = frames[0]
  if (!anchor) return null
  return selectClip(anchor, frames)
}
