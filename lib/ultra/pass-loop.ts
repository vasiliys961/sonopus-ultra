import { selectSeries, type SeriesCandidate } from '@/lib/ultra/select-series'

export const PASS_INTERVAL_MS = 333
export const PASS_MAX_MS = 10 * 60 * 1000
export const SERIES_LIMIT = 16

export function trimPass<T extends { timestamp: number; pinned?: boolean }>(shots: readonly T[], maxMs = PASS_MAX_MS): T[] {
  if (shots.length === 0) return []
  const latest = shots[shots.length - 1].timestamp
  const floor = latest - maxMs
  return shots.filter((shot) => shot.pinned || shot.timestamp >= floor)
}

export function evenSample<T>(items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return []
  if (items.length <= count) return [...items]
  const picked: T[] = []
  for (let index = 0; index < count; index += 1) {
    const at = Math.round((index * (items.length - 1)) / (count - 1))
    picked.push(items[at])
  }
  return picked
}

export function composeSeries<T extends SeriesCandidate & { pinned?: boolean }>(shots: readonly T[], limit = SERIES_LIMIT): T[] {
  const pins = shots.filter((shot) => shot.pinned).sort((a, b) => a.timestamp - b.timestamp)
  const keptPins = pins.length > limit ? pins.slice(pins.length - limit) : pins
  if (keptPins.length >= limit) return keptPins
  const pinnedIds = new Set(keptPins.map((shot) => shot.sequenceNumber))
  const rest = selectSeries(
    shots.filter((shot) => !pinnedIds.has(shot.sequenceNumber)),
    limit - keptPins.length,
  )
  return [...keptPins, ...rest].sort((a, b) => a.timestamp - b.timestamp)
}
