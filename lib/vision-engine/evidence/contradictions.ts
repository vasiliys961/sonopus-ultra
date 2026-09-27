import type { AnatomyObservation } from '@/lib/vision-engine/anatomy/anatomy-detector'

export interface Contradiction {
  code: 'possible_tracking_error'
  detail: string
}

export function findContradictions(
  anatomy: readonly AnatomyObservation[],
  measurements: readonly { structure: string; value?: number }[],
): Contradiction[] {
  const found: Contradiction[] = []
  const strong = anatomy.filter((item) => item.confidence >= 0.8 && item.laterality !== 'unknown')
  for (let i = 0; i < strong.length; i += 1) {
    for (let j = i + 1; j < strong.length; j += 1) {
      if (strong[i].organ === strong[j].organ && strong[i].laterality !== strong[j].laterality) {
        found.push({ code: 'possible_tracking_error', detail: strong[i].organ })
      }
    }
  }
  const byStructure = new Map<string, number[]>()
  for (const row of measurements) {
    if (row.value === undefined) continue
    const list = byStructure.get(row.structure) ?? []
    list.push(row.value)
    byStructure.set(row.structure, list)
  }
  for (const [structure, values] of byStructure) {
    const low = Math.min(...values)
    const high = Math.max(...values)
    if (low > 0 && (high - low) / low > 0.2) found.push({ code: 'possible_tracking_error', detail: structure })
  }
  return found
}
