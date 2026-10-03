import { planeDiff, type GrayPlane } from '@/lib/intelligence/gray'

export interface CineFrame {
  id: string
  timestamp: number
  quality: number
  plane: GrayPlane
}

export interface SampleWindow {
  from: number
  to: number
  duplicateDiff: number
}

export interface CineSampleOptions {
  /** Бюджет сборки объёма, не лимит заключения. */
  maxFrames?: number
  duplicateDiff?: number
  minQuality?: number
  /** В этих интервалах порог дубля ниже: вокруг кандидата кадры берутся плотнее. */
  windows?: readonly SampleWindow[]
}

/**
 * Оставляет кадры, которые отличаются от уже взятых.
 * Почти одинаковые соседи не раздувают объём. Быстрая смена картинки проходит плотнее.
 */
export function sampleCine(frames: readonly CineFrame[], options: CineSampleOptions = {}): CineFrame[] {
  const maxFrames = options.maxFrames ?? 48
  const duplicateDiff = options.duplicateDiff ?? 0.015
  const minQuality = options.minQuality ?? 0.2
  const ordered = [...frames].sort((left, right) => left.timestamp - right.timestamp)
  const sharp = ordered.filter((frame) => frame.quality >= minQuality)
  const pool = sharp.length >= 3 ? sharp : ordered
  const windows = options.windows ?? []
  const kept: CineFrame[] = []
  for (const frame of pool) {
    const last = kept[kept.length - 1]
    const limit = thresholdAt(frame.timestamp, duplicateDiff, windows)
    if (last && planeDiff(last.plane, frame.plane) < limit) continue
    kept.push(frame)
  }
  if (kept.length <= maxFrames) return kept
  return thin(kept, maxFrames)
}

function thresholdAt(timestamp: number, fallback: number, windows: readonly SampleWindow[]): number {
  let limit = fallback
  for (const window of windows) {
    if (timestamp >= window.from && timestamp <= window.to) limit = Math.min(limit, window.duplicateDiff)
  }
  return limit
}

function thin(frames: readonly CineFrame[], maxFrames: number): CineFrame[] {
  if (frames.length <= maxFrames || maxFrames <= 2) return frames.slice(0, Math.max(0, maxFrames))
  const scored = frames.map((frame, index) => {
    const previous = frames[index - 1] ?? frame
    const next = frames[index + 1] ?? frame
    return { frame, novelty: planeDiff(previous.plane, frame.plane) + planeDiff(frame.plane, next.plane) }
  })
  const first = scored[0]
  const last = scored[scored.length - 1]
  if (!first || !last) return []
  const middle = scored.slice(1, -1).sort((left, right) => right.novelty - left.novelty).slice(0, maxFrames - 2)
  return [first, ...middle, last].sort((left, right) => left.frame.timestamp - right.frame.timestamp).map((item) => item.frame)
}
