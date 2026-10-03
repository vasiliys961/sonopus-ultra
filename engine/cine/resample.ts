import type { SampleWindow } from '@/lib/intelligence/sample-cine'

/** Окно, где порог «тот же кадр» ниже. Радиус в миллисекундах исходного ролика. */
export function windowsAround(timestamps: readonly number[], radiusMs = 700, duplicateDiff = 0.004): SampleWindow[] {
  const windows: SampleWindow[] = []
  for (const timestamp of timestamps) {
    if (!Number.isFinite(timestamp)) continue
    windows.push({ from: timestamp - radiusMs, to: timestamp + radiusMs, duplicateDiff })
  }
  return windows
}
