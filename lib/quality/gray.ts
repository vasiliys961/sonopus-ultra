import type { Raster } from '@/lib/domain/types'

export function rasterToGray(raster: Raster): Float32Array {
  const { data, width, height } = raster
  const gray = new Float32Array(width * height)
  const pixels = Math.min(gray.length, Math.floor(data.length / 4))
  for (let i = 0; i < pixels; i += 1) {
    const p = i * 4
    gray[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255
  }
  return gray
}

export function grayToRaster(gray: Float32Array, width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round((gray[i] ?? 0) * 255)))
    const p = i * 4
    data[p] = value
    data[p + 1] = value
    data[p + 2] = value
    data[p + 3] = 255
  }
  return { width, height, data }
}
