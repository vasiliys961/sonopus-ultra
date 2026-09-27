import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

/** Шкала кадра. Один общий мм/пиксель сюда не подставляется. */
export interface UltrasoundCalibration {
  pixelSpacingX: number
  pixelSpacingY: number
  depthMm?: number
  probeWidthMm?: number
  origin?: Vec3
  orientation?: Mat4
  probeOrigin?: Vec3
  probeOrientation?: Mat4
  depthScale?: number
}
