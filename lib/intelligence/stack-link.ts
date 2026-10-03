/** Глубина кадра → номер аксиального среза объёма. */
export function axialIndexForDepth(originZ: number, spacingZ: number, sizeZ: number, depth: number): number {
  if (sizeZ <= 0) return 0
  const index = Math.round((depth - originZ) / (spacingZ || 1))
  return Math.max(0, Math.min(sizeZ - 1, index))
}

/** Аксиальный срез → ближайший кадр петли по глубине. */
export function cineIndexForAxial(
  slices: readonly { depth: number }[],
  originZ: number,
  spacingZ: number,
  axial: number,
): number {
  if (slices.length === 0) return 0
  const world = originZ + axial * (spacingZ || 1)
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  slices.forEach((slice, index) => {
    const distance = Math.abs(slice.depth - world)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}
