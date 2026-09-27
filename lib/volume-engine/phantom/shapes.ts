import { dofToMatrix } from '@/lib/spatial-reconstruction/rigid'
import type { FreehandFrame } from '@/lib/volume-engine/core/VolumeEngine'

function paintFrame(
  size: number,
  paint: (u: number, v: number) => number,
  zMm: number,
  frameIndex: number,
): FreehandFrame {
  const image = new Float32Array(size * size)
  const fieldMask = new Uint8Array(size * size)
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const value = paint(u, v)
      const index = v * size + u
      if (value < 0) continue
      fieldMask[index] = 1
      image[index] = value
    }
  }
  return {
    frameId: `phantom-${frameIndex}`,
    timestamp: frameIndex,
    image,
    width: size,
    height: size,
    pixelSpacingX: 1,
    pixelSpacingY: 1,
    fieldMask,
    transform: dofToMatrix([0, 0, zMm], [0, 0, 0]),
    confidence: 1,
    uncertaintyMm: 0,
  }
}

/** Две точки на z = 0 и z = 5 мм. Ядро радиуса 1 мм не должно закрасить середину. */
export function gapFrames(): FreehandFrame[] {
  const dot = (u: number, v: number) => (u === 2 && v === 2 ? 1 : -1)
  return [paintFrame(4, dot, 0, 0), paintFrame(4, dot, 5, 1)]
}

/** Квадрат 8×8 пикселей на пяти плоскостях. Тестовая геометрия, не пациент. */
export function slabFrames(): FreehandFrame[] {
  const square = (u: number, v: number) => (u >= 4 && u <= 11 && v >= 4 && v <= 11 ? 0.85 : -1)
  return [0, 1, 2, 3, 4].map((z) => paintFrame(16, square, z, z))
}

/** Диск известного радиуса 3 пикселя = 3 мм при шкале 1 мм/пиксель. */
export function sphereFrames(): FreehandFrame[] {
  const radius = 3
  const center = 8
  return [-2, -1, 0, 1, 2].map((z, index) => paintFrame(16, (u, v) => {
    const dx = u - center
    const dy = v - center
    const dz = z
    return dx * dx + dy * dy + dz * dz <= radius * radius ? 0.9 : -1
  }, z, index))
}

export function shiftedPair(shiftPx: number): FreehandFrame[] {
  const size = 16
  const block = (origin: number) => (u: number, v: number) => (u >= origin && u < origin + 4 && v >= 4 && v < 8 ? 1 : 0)
  const first = paintFrame(size, block(2), 0, 0)
  const second = paintFrame(size, block(2 + shiftPx), 0, 1)
  first.transform = undefined
  second.transform = undefined
  return [first, second]
}

/** Столбик известного сечения 4×4 мм на четырёх плоскостях. */
export function cylinderFrames(): FreehandFrame[] {
  const bar = (u: number, v: number) => (u >= 6 && u <= 9 && v >= 6 && v <= 9 ? 1 : -1)
  return [0, 1, 2, 3].map((z) => paintFrame(16, bar, z, z))
}

export function singleBrightFrame(xMm: number): FreehandFrame {
  const frame = paintFrame(3, (u, v) => (u === 1 && v === 1 ? 1 : -1), 0, 0)
  frame.transform = dofToMatrix([xMm, 0, 0], [0, 0, 0])
  return frame
}
