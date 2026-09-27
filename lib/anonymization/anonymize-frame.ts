import type { Raster, UltrasoundFrame } from '@/lib/domain/types'

export interface MaskRect {
  x: number
  y: number
  width: number
  height: number
}

/** Типичные зоны наложенного ФИО: верхняя строка аппарата, нижний баннер, левый угол. */
export function defaultPhiMasks(width: number, height: number): MaskRect[] {
  const top = Math.max(1, Math.round(height * 0.08))
  const bottom = Math.max(1, Math.round(height * 0.12))
  const cornerW = Math.max(1, Math.round(width * 0.28))
  const cornerH = Math.max(1, Math.round(height * 0.1))
  return [
    { x: 0, y: 0, width, height: top },
    { x: 0, y: Math.max(0, height - bottom), width, height: bottom },
    { x: 0, y: top, width: cornerW, height: cornerH },
  ]
}

export function anonymizeRaster(raster: Raster, masks = defaultPhiMasks(raster.width, raster.height)): Raster {
  const data = new Uint8ClampedArray(raster.data)
  for (const mask of masks) {
    const x0 = Math.max(0, Math.floor(mask.x))
    const y0 = Math.max(0, Math.floor(mask.y))
    const x1 = Math.min(raster.width, Math.ceil(mask.x + mask.width))
    const y1 = Math.min(raster.height, Math.ceil(mask.y + mask.height))
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = (y * raster.width + x) * 4
        data[p] = 0
        data[p + 1] = 0
        data[p + 2] = 0
        data[p + 3] = 255
      }
    }
  }
  return { width: raster.width, height: raster.height, data }
}

export function anonymizeFrame(frame: UltrasoundFrame): UltrasoundFrame {
  return { ...frame, imageData: anonymizeRaster(frame.imageData) }
}
