export interface FusionStatus {
  applied: false
  reason: string
}

/** Слияние с MRI/CT не запускается, пока второй объём не передан явно. */
export function fuseVolumes(): FusionStatus {
  return { applied: false, reason: 'MRI или CT не загружены. Слияние не выполняется.' }
}
