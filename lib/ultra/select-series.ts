export interface SeriesCandidate {
  qualityScore: number
  timestamp: number
  sequenceNumber: number
}

export function selectSeries<T extends SeriesCandidate>(shots: readonly T[], limit = 16, minGapMs = 400): T[] {
  if (shots.length === 0) return []
  const sharp = shots.filter((shot) => shot.qualityScore >= 0.75)
  const pool = [...(sharp.length > 0 ? sharp : shots)].sort((a, b) => b.qualityScore - a.qualityScore || a.timestamp - b.timestamp)
  const picked: T[] = []
  for (const shot of pool) {
    if (picked.length >= limit) break
    if (picked.every((kept) => Math.abs(kept.timestamp - shot.timestamp) >= minGapMs)) picked.push(shot)
  }
  return picked.sort((a, b) => a.timestamp - b.timestamp)
}
