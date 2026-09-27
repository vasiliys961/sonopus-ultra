import { bytesToBase64 } from '@/lib/image/base64'
import { jpegToRaster } from '@/lib/ultra/frame-jpeg'
import { composeSeries, evenSample, SERIES_LIMIT } from '@/lib/ultra/pass-loop'

export interface StoredFrame {
  jpeg: string
  width: number
  height: number
  qualityScore: number
  timestamp: number
  sequenceNumber: number
  pinned?: boolean
}

function evidenceId(shot: StoredFrame): string {
  return `pass-${shot.sequenceNumber}`
}

async function askBatch(batch: readonly StoredFrame[], organ: string, limit: number): Promise<string[]> {
  if (batch.length === 0 || limit <= 0) return []
  const frames = []
  for (const shot of batch) {
    if (!shot.jpeg) continue
    const raster = await jpegToRaster(shot.jpeg)
    frames.push({
      evidenceId: evidenceId(shot),
      width: raster.width,
      height: raster.height,
      rgbaBase64: bytesToBase64(raster.data),
    })
  }
  if (frames.length === 0) return []
  const response = await fetch('/api/sono/pick-frames', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organ, limit, frames }),
  })
  const payload = (await response.json()) as { keep?: string[] }
  return payload.keep ?? []
}

export async function chooseSeries<T extends StoredFrame>(shots: readonly T[], organ: string, limit = SERIES_LIMIT): Promise<T[]> {
  const pins = shots.filter((shot) => shot.pinned)
  if (pins.length >= limit) return composeSeries(shots, limit) as T[]
  const sample = evenSample(shots.filter((shot) => !shot.pinned), 24)
  const kept = new Set(pins.map((shot) => shot.sequenceNumber))
  try {
    for (let index = 0; index < sample.length && kept.size < limit; index += 8) {
      const batch = sample.slice(index, index + 8)
      const ids = await askBatch(batch, organ, Math.min(4, limit - kept.size))
      for (const id of ids) {
        const shot = batch.find((item) => evidenceId(item) === id)
        if (shot) kept.add(shot.sequenceNumber)
      }
    }
  } catch {
    return composeSeries(shots, limit) as T[]
  }
  const chosen = shots.filter((shot) => kept.has(shot.sequenceNumber))
  if (chosen.filter((shot) => !shot.pinned).length === 0) return composeSeries(shots, limit) as T[]
  return [...chosen].sort((a, b) => a.timestamp - b.timestamp).slice(0, limit)
}
