import type { CoverageMap, Sector, Vec3 } from '@/lib/spatial-reconstruction/types'

export const SECTORS: readonly Sector[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z']

function sectorsOf(offset: Vec3): Sector[] {
  const axes: Array<[Sector, number]> = [
    ['+X', offset[0]],
    ['-X', -offset[0]],
    ['+Y', offset[1]],
    ['-Y', -offset[1]],
    ['+Z', offset[2]],
    ['-Z', -offset[2]],
  ]
  const peak = Math.max(...axes.map(([, value]) => value))
  if (peak <= 0) return []
  return axes.filter(([, value]) => value === peak).map(([sector]) => sector)
}

export function coverageFromPoints(points: readonly Vec3[]): CoverageMap {
  if (points.length === 0) {
    return {
      covered: [],
      missing: [...SECTORS],
      hints: SECTORS.map((sector) => `Не хватает ракурса со стороны ${sector}.`),
    }
  }
  const centroid: Vec3 = [0, 0, 0]
  for (const point of points) {
    centroid[0] += point[0]
    centroid[1] += point[1]
    centroid[2] += point[2]
  }
  centroid[0] /= points.length
  centroid[1] /= points.length
  centroid[2] /= points.length
  const seen = new Set<Sector>()
  for (const point of points) {
    for (const sector of sectorsOf([point[0] - centroid[0], point[1] - centroid[1], point[2] - centroid[2]])) {
      seen.add(sector)
    }
  }
  const covered = SECTORS.filter((sector) => seen.has(sector))
  const missing = SECTORS.filter((sector) => !seen.has(sector))
  return {
    covered,
    missing,
    hints: missing.map((sector) => `Не хватает ракурса со стороны ${sector}.`),
  }
}
