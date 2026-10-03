import { applyRigid, rigidFromLandmarks } from '@/engine/registration/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

export interface NormPoint {
  u: number
  v: number
}

export interface FramePair {
  ultrasound: NormPoint
  other: NormPoint
}

export interface FrameShift {
  matrix: Mat4
  confidence: number
  pairs: number
}

/** До двух пар. Точка серии переносится на точку УЗИ. Третья пара не включает аффинный шаг. */
export function frameShift(pairs: readonly FramePair[], width: number, height: number): FrameShift | null {
  const used = pairs.slice(0, 2)
  if (used.length === 0 || width < 1 || height < 1) return null
  const source = used.map((pair) => [pair.other.u * width, pair.other.v * height, 0] as Vec3)
  const target = used.map((pair) => [pair.ultrasound.u * width, pair.ultrasound.v * height, 0] as Vec3)
  const fit = rigidFromLandmarks(source, target)
  if (!fit) return null
  return { matrix: fit.matrix, confidence: used.length === 1 ? 0.4 : Math.min(fit.confidence, 0.55), pairs: used.length }
}

export function mapOtherPoint(shift: FrameShift, point: NormPoint, width: number, height: number): NormPoint {
  const moved = applyRigid(shift.matrix, [point.u * width, point.v * height, 0])
  return { u: moved[0] / width, v: moved[1] / height }
}
