import type { TemporalSummary } from '@/types/temporal-ultrasound'

/** 1 — соседние срезы похожи. Это не оптический поток и не трекинг датчика. */
export function temporalConsistency(summary: TemporalSummary): number {
  return Math.max(0, Math.min(1, 1 - summary.meanChange))
}
