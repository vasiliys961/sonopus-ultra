import type { TemporalSummary } from '@/types/temporal-ultrasound'

/** similarity 1 — кадр как предыдущий. Изменение = 1 − similarity. */
export function motionFromSimilarities(similarities: readonly number[]): TemporalSummary {
  const changes = similarities.slice(1).map((value) => Math.max(0, Math.min(1, 1 - value)))
  if (changes.length === 0) return { meanChange: 0, peakChange: 0, changedSteps: 0, stable: true }
  const sum = changes.reduce((total, value) => total + value, 0)
  const peakChange = Math.max(...changes)
  const changedSteps = changes.filter((value) => value > 0.07).length
  return {
    meanChange: sum / changes.length,
    peakChange,
    changedSteps,
    stable: changedSteps < 2,
  }
}
