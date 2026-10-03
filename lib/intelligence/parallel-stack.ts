import { matchShift } from '@/lib/intelligence/gray'
import type { CineFrame } from '@/lib/intelligence/sample-cine'
import { dofToMatrix } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4 } from '@/lib/spatial-reconstruction/types'

export interface StackedSlice {
  id: string
  timestamp: number
  quality: number
  gray: Float32Array
  width: number
  height: number
  mask: Uint8Array
  transform: Mat4
  /** 0..1, насколько кадр похож на предыдущий после сдвига в плоскости. */
  similarity: number
  /** Оценка по картинке. Это не показание трекера. */
  confidence: number
  depth: number
  /** Накопленный ход в единицах сетки: плоскость и глубина. */
  probe: { x: number; y: number; z: number }
}

/**
 * Свободный проход не является стопкой МРТ.
 * Сдвиг картинки между кадрами — оценка хода датчика в плоскости.
 * Смена, которую сдвигом не объяснить, добавляет шаг по глубине.
 * Это единицы сетки, не датчик положения.
 */
export function parallelStack(frames: readonly CineFrame[]): StackedSlice[] {
  const slices: StackedSlice[] = []
  let x = 0
  let y = 0
  let depth = 0
  for (const frame of frames) {
    const previous = slices[slices.length - 1]
    let similarity = 1
    if (previous) {
      const shift = matchShift(
        { gray: previous.gray, width: previous.width, height: previous.height },
        frame.plane,
      )
      x += -shift.dx
      y += -shift.dy
      similarity = shift.similarity
      depth += similarity > 0.93 ? 0.45 : 1
    }
    slices.push({
      id: frame.id,
      timestamp: frame.timestamp,
      quality: frame.quality,
      gray: frame.plane.gray,
      width: frame.plane.width,
      height: frame.plane.height,
      mask: tissueMask(frame.plane.gray, 0.04),
      transform: dofToMatrix([x, y, depth], [0, 0, 0]),
      similarity,
      confidence: Math.max(0.4, Math.min(0.7, 0.45 + similarity * 0.2)),
      depth,
      probe: { x, y, z: depth },
    })
  }
  return slices
}

export function probeTravel(points: readonly { probeX: number; probeY: number; depth: number }[]): { lateral: number; depth: number } {
  let lateral = 0
  let depth = 0
  for (const point of points) {
    lateral = Math.max(lateral, Math.hypot(point.probeX, point.probeY))
    depth = Math.max(depth, Math.abs(point.depth))
  }
  return { lateral, depth }
}

function tissueMask(gray: Float32Array, tissue: number): Uint8Array {
  const mask = new Uint8Array(gray.length)
  for (let index = 0; index < gray.length; index += 1) {
    if ((gray[index] ?? 0) >= tissue) mask[index] = 1
  }
  return mask
}
