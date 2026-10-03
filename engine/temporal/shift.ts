import { matchShift, type GrayPlane } from '@/lib/intelligence/gray'
import type { InPlaneShift } from '@/types/temporal-ultrasound'

export type { InPlaneShift }

/** Сдвиг внутри плоскости кадра. Это не положение датчика в пространстве. */
export function inPlaneShift(planes: readonly GrayPlane[]): InPlaneShift {
  if (planes.length < 2) return { meanDx: 0, meanDy: 0, source: 'VIDEO_ESTIMATION' }
  const step = Math.max(1, Math.floor(planes.length / 8))
  let dx = 0
  let dy = 0
  let count = 0
  for (let index = 0; index + step < planes.length; index += step) {
    const left = planes[index]
    const right = planes[index + step]
    if (!left || !right) continue
    const shift = matchShift(left, right, 3)
    dx += shift.dx
    dy += shift.dy
    count += 1
  }
  return {
    meanDx: count === 0 ? 0 : dx / count,
    meanDy: count === 0 ? 0 : dy / count,
    source: 'VIDEO_ESTIMATION',
  }
}
