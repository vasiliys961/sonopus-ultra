import { assertDimensionMm } from '@/lib/domain/number'

/** Коэффициент эллипсоида, принятый в POCUS: V = 0.52 × Д × Ш × В. */
export const ELLIPSOID_COEFFICIENT = 0.52

/**
 * Объём в миллилитрах.
 * Литература задаёт размеры в сантиметрах (1 см³ = 1 мл).
 * Вход здесь в миллиметрах, поэтому результат делится на 1000.
 */
export function computeEllipsoidVolumeMl(depthMm: number, widthMm: number, heightMm: number): number {
  assertDimensionMm(depthMm, 'depthMm')
  assertDimensionMm(widthMm, 'widthMm')
  assertDimensionMm(heightMm, 'heightMm')
  return (depthMm * widthMm * heightMm * ELLIPSOID_COEFFICIENT) / 1000
}
