import type { BufferedFrame } from '@/lib/vision-engine/frame-buffer'

export interface SelectedClip {
  id: string
  startTime: number
  endTime: number
  fps: number
  reason: 'best_quality' | 'anatomy' | 'measurement' | 'motion' | 'protocol' | 'uncertain'
  qualityScore: number
  frameIds: string[]
}

export function selectClip(anchor: BufferedFrame, frames: readonly BufferedFrame[], fps = 2): SelectedClip {
  const startTime = anchor.metrics.timestamp - 2000
  const endTime = anchor.metrics.timestamp + 3000
  return {
    id: `clip-${anchor.id}`,
    startTime,
    endTime,
    fps,
    reason: 'best_quality',
    qualityScore: anchor.metrics.qualityScore,
    frameIds: frames.filter((item) => item.metrics.timestamp >= startTime && item.metrics.timestamp <= endTime).map((item) => item.id),
  }
}
