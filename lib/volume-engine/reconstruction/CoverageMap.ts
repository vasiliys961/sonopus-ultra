export function coverageRatio(observed: Uint8Array): number {
  if (observed.length === 0) return 0
  let seen = 0
  for (const bit of observed) seen += bit
  return seen / observed.length
}

export function meanCoverage(coverage: Float32Array, observed: Uint8Array): number {
  let sum = 0
  let count = 0
  for (let index = 0; index < observed.length; index += 1) {
    if (observed[index] !== 1) continue
    sum += coverage[index] ?? 0
    count += 1
  }
  return count === 0 ? 0 : sum / count
}
