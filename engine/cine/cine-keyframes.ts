import type { KeyFrame, KeyFrameKind } from '@/types/temporal-ultrasound'
import type { USFrame } from '@/types/spatial-ultrasound'

export function selectKeyFrames(frames: readonly USFrame[], suspectIds: readonly string[] = []): KeyFrame[] {
  if (frames.length === 0) return []
  const picked = new Map<string, KeyFrameKind>()
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (first) picked.set(first.id, 'BOUNDARY')
  if (last && last.id !== first?.id) picked.set(last.id, 'BOUNDARY')
  const best = [...frames].sort((left, right) => right.quality.overall - left.quality.overall)[0]
  if (best) picked.set(best.id, 'BEST_QUALITY')
  let motionId = ''
  let motionScore = 0
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    if (!previous || !current) continue
    const change = Math.abs(current.quality.contrast - previous.quality.contrast) + (1 - (current.pose?.confidence ?? 0)) * 0.2
    if (change > motionScore) {
      motionScore = change
      motionId = current.id
    }
  }
  if (motionId && motionScore > 0.05) picked.set(motionId, 'MOTION')
  for (const id of suspectIds) {
    if (frames.some((frame) => frame.id === id)) picked.set(id, 'PATHOLOGY_SUSPECT')
  }
  return [...picked.entries()].map(([frameId, kind]) => {
    const frame = frames.find((item) => item.id === frameId)
    return { frameId, timestamp: frame?.timestamp ?? 0, kind }
  })
}
