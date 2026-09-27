import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

/** Шкала кадра. Один общий мм/пиксель сюда не подставляется. */
export interface UltrasoundCalibration {
  pixelSpacingX: number
  pixelSpacingY: number
  probeOrigin?: Vec3
  probeOrientation?: Mat4
  depthScale?: number
}
