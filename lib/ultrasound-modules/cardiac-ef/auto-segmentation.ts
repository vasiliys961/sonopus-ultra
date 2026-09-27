import type { Point } from '@/lib/domain/types'
import { assertFinite } from '@/lib/domain/number'
import type { ManualMeasurement } from '@/lib/domain/types'

export type CardiacManual = Extract<ManualMeasurement, { kind: 'cardiac-ef' }>

export interface ModelContour {
  plane: 'a4c' | 'a2c'
  phase: 'diastole' | 'systole'
  points: Point[]
}

type ContourKey = 'a4cDiastole' | 'a4cSystole' | 'a2cDiastole' | 'a2cSystole'

const KEY: Record<ModelContour['plane'], Record<ModelContour['phase'], ContourKey>> = {
  a4c: { diastole: 'a4cDiastole', systole: 'a4cSystole' },
  a2c: { diastole: 'a2cDiastole', systole: 'a2cSystole' },
}

/** Контур приходит координатами из модели. Сырой кадр сюда не входит. */
export function acceptModelContour(contour: ModelContour): Point[] {
  if (contour.points.length < 8) {
    throw new Error('модель должна отдать не меньше 8 точек контура')
  }
  return contour.points.map((point, index) => {
    assertFinite(point.x, `x${index}`)
    assertFinite(point.y, `y${index}`)
    return { x: point.x, y: point.y }
  })
}

export function mergeModelContours(manual: CardiacManual, contours: ModelContour[]): CardiacManual {
  const next: CardiacManual = { ...manual, contourSource: 'model' }
  for (const contour of contours) {
    next[KEY[contour.plane][contour.phase]] = acceptModelContour(contour)
  }
  return next
}
