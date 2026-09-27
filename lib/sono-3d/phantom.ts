import { dofToMatrix } from '@/lib/spatial-reconstruction/rigid'
import { compoundSweep } from '@/lib/sono-3d/compound'
import type { FramePose, ReconstructedVolume, SweepFrame } from '@/lib/sono-3d/types'
import { POSE_MODEL_UNAVAILABLE } from '@/lib/sono-3d/types'

function poseAt(frameIndex: number, zMm: number): FramePose {
  return {
    frameIndex,
    matrix: dofToMatrix([0, 0, zMm], [0, 0, 0]),
    source: 'reference',
    uncertaintyMm: 0,
    algorithmVersion: 'reference-test-1',
  }
}

function plane(size: number, paint: (u: number, v: number) => number, zMm: number, frameIndex: number): SweepFrame {
  const gray = new Float32Array(size * size)
  const field = new Uint8Array(size * size)
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const value = paint(u, v)
      const index = v * size + u
      if (value < 0) continue
      field[index] = 1
      gray[index] = value
    }
  }
  return {
    gray,
    width: size,
    height: size,
    field,
    mmPerPixelX: 1,
    mmPerPixelY: 1,
    pose: poseAt(frameIndex, zMm),
  }
}

/** Маленький фантом для тестов: две плоскости, между ними воксель не заполняется. */
export function referenceGapPhantom(): ReconstructedVolume {
  const dot = (u: number, v: number) => (u === 2 && v === 2 ? 1 : -1)
  return compoundSweep([plane(4, dot, 0, 0), plane(4, dot, 2, 1)], 1, 'reference_test')
}

/** Квадрат на пяти параллельных плоскостях. Это тестовая геометрия, не пациент. */
export function referenceDisplayPhantom(): ReconstructedVolume {
  const square = (u: number, v: number) => (u >= 4 && u <= 11 && v >= 4 && v <= 11 ? 0.85 : -1)
  const frames = [0, 1, 2, 3, 4].map((z) => plane(16, square, z, z))
  return compoundSweep(frames, 1, 'reference_test')
}

export function sensorlessUnavailable(): { code: typeof POSE_MODEL_UNAVAILABLE; volume: null } {
  return { code: POSE_MODEL_UNAVAILABLE, volume: null }
}
