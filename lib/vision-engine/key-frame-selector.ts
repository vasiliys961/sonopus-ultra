import type { BufferedFrame } from '@/lib/vision-engine/frame-buffer'
import { DEFAULT_KEYFRAME_WEIGHTS, type KeyFrameScore, type KeyFrameWeights } from '@/lib/vision-engine/types'

export interface KeyFrameContext {
  anatomyScore?: number
  planeScore?: number
  protocolValue?: number
  previousSelectedAt?: number | null
  noveltyWindowMs?: number
}

export function scoreKeyFrame(frame: BufferedFrame, context: KeyFrameContext = {}, weights: KeyFrameWeights = DEFAULT_KEYFRAME_WEIGHTS): KeyFrameScore {
  const qualityScore = frame.metrics.qualityScore
  const anatomyScore = context.anatomyScore ?? 0
  const planeScore = context.planeScore ?? 0
  const protocolValue = context.protocolValue ?? 0
  const windowMs = context.noveltyWindowMs ?? 2000
  const gap = context.previousSelectedAt == null ? windowMs : frame.metrics.timestamp - context.previousSelectedAt
  const noveltyScore = Math.max(0, Math.min(1, gap / windowMs))
  const finalScore =
    weights.quality * qualityScore +
    weights.anatomy * anatomyScore +
    weights.plane * planeScore +
    weights.novelty * noveltyScore +
    weights.protocol * protocolValue
  return { qualityScore, anatomyScore, planeScore, noveltyScore, protocolValue, finalScore }
}

export function selectKeyFrames(
  frames: readonly BufferedFrame[],
  options: { limit: number; minGapMs: number; weights?: KeyFrameWeights; context?: KeyFrameContext } ,
): BufferedFrame[] {
  const ranked = [...frames].sort((left, right) => scoreKeyFrame(right, options.context, options.weights).finalScore - scoreKeyFrame(left, options.context, options.weights).finalScore)
  const picked: BufferedFrame[] = []
  for (const frame of ranked) {
    if (picked.length >= options.limit) break
    const tooClose = picked.some((item) => Math.abs(item.metrics.timestamp - frame.metrics.timestamp) < options.minGapMs)
    if (tooClose) continue
    picked.push(frame)
  }
  return picked.sort((left, right) => left.metrics.timestamp - right.metrics.timestamp)
}
