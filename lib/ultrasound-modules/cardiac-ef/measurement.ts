import type { Point } from '@/lib/domain/types'
import { assertNonNegative, assertPositive } from '@/lib/domain/number'

export function computeEF(edvMl: number, esvMl: number): number {
  assertPositive(edvMl, 'EDV')
  assertNonNegative(esvMl, 'ESV')
  if (esvMl > edvMl) throw new Error('ESV не может быть больше EDV')
  return ((edvMl - esvMl) / edvMl) * 100
}

export function simpsonDisksVolumeMl(diametersMm: number[], sliceHeightMm: number): number {
  if (diametersMm.length < 1) throw new Error('для Симпсона нужен хотя бы один диск')
  assertPositive(sliceHeightMm, 'sliceHeightMm')
  let sumSquares = 0
  for (const diameter of diametersMm) {
    assertPositive(diameter, 'diameterMm')
    sumSquares += diameter * diameter
  }
  return ((Math.PI / 4) * sumSquares * sliceHeightMm) / 1000
}

export function simpsonBiplaneVolumeMl(
  diametersAMm: number[],
  diametersBMm: number[],
  sliceHeightMm: number,
): number {
  if (diametersAMm.length < 1 || diametersAMm.length !== diametersBMm.length) {
    throw new Error('биплановые диаметры должны быть парными и непустыми')
  }
  assertPositive(sliceHeightMm, 'sliceHeightMm')
  let sum = 0
  for (let i = 0; i < diametersAMm.length; i += 1) {
    const a = diametersAMm[i] ?? Number.NaN
    const b = diametersBMm[i] ?? Number.NaN
    assertPositive(a, 'diameterA')
    assertPositive(b, 'diameterB')
    sum += a * b
  }
  return ((Math.PI / 4) * sum * sliceHeightMm) / 1000
}

export interface DiskSeries {
  diametersPx: number[]
  sliceHeightPx: number
  longAxisPx: number
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function segmentHitsPerpendicular(a: Point, b: Point, origin: Point, axisX: number, axisY: number): Point | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = dx * axisX + dy * axisY
  if (Math.abs(denom) < 1e-8) return null
  const t = ((origin.x - a.x) * axisX + (origin.y - a.y) * axisY) / denom
  if (t < -1e-6 || t > 1 + 1e-6) return null
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/** Полигон из 8+ точек. Меньше точек недостаточно для дисков Симпсона. */
export function diametersFromContour(points: Point[], diskCount = 20): DiskSeries | null {
  if (points.length < 8 || diskCount < 4) return null
  let apex = points[0]
  let base = points[1]
  let best = -1
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = dist(points[i], points[j])
      if (distance > best) {
        best = distance
        apex = points[i]
        base = points[j]
      }
    }
  }
  if (!apex || !base || best < 4) return null
  const axisX = (base.x - apex.x) / best
  const axisY = (base.y - apex.y) / best
  const closed = [...points, points[0]]
  const diametersPx: number[] = []
  for (let step = 1; step < diskCount; step += 1) {
    const t = step / diskCount
    const origin = { x: apex.x + (base.x - apex.x) * t, y: apex.y + (base.y - apex.y) * t }
    const hits: Point[] = []
    for (let i = 0; i < closed.length - 1; i += 1) {
      const hit = segmentHitsPerpendicular(closed[i], closed[i + 1], origin, axisX, axisY)
      if (hit) hits.push(hit)
    }
    if (hits.length < 2) continue
    let diameter = 0
    for (let i = 0; i < hits.length; i += 1) {
      for (let j = i + 1; j < hits.length; j += 1) diameter = Math.max(diameter, dist(hits[i], hits[j]))
    }
    if (diameter > 0.5) diametersPx.push(diameter)
  }
  if (diametersPx.length < 4) return null
  return { diametersPx, sliceHeightPx: best / diskCount, longAxisPx: best }
}
