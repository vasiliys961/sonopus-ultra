/** Сколько моментов читать из ролика до отбора. Это не лимит 8–12 для заключения. */
export function sampleTimes(durationSec: number): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [0]
  const count = durationSec < 2 ? 16 : durationSec < 8 ? 36 : durationSec < 30 ? 72 : 120
  const last = Math.max(0, durationSec - 0.05)
  const times: number[] = []
  for (let index = 0; index < count; index += 1) {
    times.push((index * last) / (count - 1))
  }
  return times
}

/** Сколько кадров петли декодировать перед выкидыванием дублей. */
export function decodeBudget(durationMs: number, available: number): number {
  if (available <= 0) return 0
  const seconds = Math.max(0, durationMs) / 1000
  const target = seconds < 3 ? 36 : seconds < 12 ? 72 : 120
  return Math.min(available, target)
}
