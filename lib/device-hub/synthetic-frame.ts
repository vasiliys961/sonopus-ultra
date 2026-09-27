import type { Raster } from '@/lib/domain/types'
import { grayToRaster } from '@/lib/quality/gray'

export interface SyntheticScene {
  blurPasses: number
  gain: number
  motionShift: number
  phase: number
}

function boxBlur(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(gray.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = y + dy
          const xx = x + dx
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue
          sum += gray[yy * width + xx] ?? 0
          count += 1
        }
      }
      out[y * width + x] = count > 0 ? sum / count : 0
    }
  }
  return out
}

export function renderSyntheticRaster(
  scene: Partial<SyntheticScene> & { width?: number; height?: number } = {},
): Raster {
  const width = scene.width ?? 160
  const height = scene.height ?? 120
  const gain = scene.gain ?? 1
  const shift = scene.motionShift ?? 0
  const phase = scene.phase ?? 0
  let gray: Float32Array = new Float32Array(width * height)
  const cx = width / 2 + shift
  const cy = height * 0.12
  const radius = Math.min(width, height) * 0.92
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (y < cy || Math.hypot(dx, dy) > radius) continue
      const speckle = ((x * 17 + y * 13 + Math.floor(phase * 20)) % 11) / 11
      const ex = (x - width / 2) / (width * 0.16)
      const ey = (y - height * 0.58) / (height * 0.14)
      const ellipse = ex * ex + ey * ey
      let value = 0.28 + speckle * 0.2
      if ((x + y) % 2 === 0) value += 0.45
      if (ellipse < 1) value = 0.05
      else if (ellipse < 1.35) value = 0.95
      gray[y * width + x] = Math.max(0, Math.min(1, value * gain))
    }
  }
  const passes = Math.max(0, Math.min(8, scene.blurPasses ?? 0))
  for (let pass = 0; pass < passes; pass += 1) gray = boxBlur(gray, width, height)
  return grayToRaster(gray, width, height)
}
