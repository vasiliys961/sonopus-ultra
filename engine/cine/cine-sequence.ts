import type { TemporalSequence } from '@/types/temporal-ultrasound'
import type { USFrame } from '@/types/spatial-ultrasound'

/** Короткие окна для будущего разбора движения. В модель целиком петля не уходит. */
export function temporalSequences(frames: readonly USFrame[], window = 5): TemporalSequence[] {
  if (frames.length === 0) return []
  const size = Math.max(2, Math.min(window, frames.length))
  const sequences: TemporalSequence[] = []
  const step = Math.max(1, size - 2)
  for (let start = 0; start < frames.length; start += step) {
    const slice = frames.slice(start, start + size)
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (!first || !last) continue
    sequences.push({ frameIds: slice.map((frame) => frame.id), from: first.timestamp, to: last.timestamp })
    if (start + size >= frames.length) break
  }
  return sequences.slice(0, 8)
}
