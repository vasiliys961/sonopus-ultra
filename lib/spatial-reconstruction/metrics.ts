import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

export interface FramePair {
  predicted: Mat4
  truth: Mat4
}

export interface ReconstructionErrors {
  gpeMm: number
  gleMm: number
  /** Локальная ошибка пикселей. В TUS-REC2024 это LPE. */
  lpeMm: number
  /** То же значение, что lpeMm: в ТЗ метрика названа LEP. */
  lepMm: number
  lleMm: number
}

function distance(left: Vec3, right: Vec3): number {
  const dx = left[0] - right[0]
  const dy = left[1] - right[1]
  const dz = left[2] - right[2]
  return Math.hypot(dx, dy, dz)
}

function meanFrameError(pairs: readonly FramePair[], points: readonly Vec3[]): number {
  if (pairs.length === 0 || points.length === 0) throw new Error('для метрики нужны кадры и точки')
  let sum = 0
  let count = 0
  for (const pair of pairs) {
    for (const point of points) {
      sum += distance(transformPoint(pair.predicted, point), transformPoint(pair.truth, point))
      count += 1
    }
  }
  return sum / count
}

/** Средняя евклидова ошибка положения точек в миллиметрах, как GPE/GLE/LPE/LLE в TUS-REC2024. */
export function scoreReconstruction(input: {
  globalPixels: readonly FramePair[]
  globalLandmarks: readonly FramePair[]
  localPixels: readonly FramePair[]
  localLandmarks: readonly FramePair[]
  pixelsMm: readonly Vec3[]
  landmarksMm: readonly Vec3[]
}): ReconstructionErrors {
  const lpeMm = meanFrameError(input.localPixels, input.pixelsMm)
  return {
    gpeMm: meanFrameError(input.globalPixels, input.pixelsMm),
    gleMm: meanFrameError(input.globalLandmarks, input.landmarksMm),
    lpeMm,
    lepMm: lpeMm,
    lleMm: meanFrameError(input.localLandmarks, input.landmarksMm),
  }
}
