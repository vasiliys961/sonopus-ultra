import { poseEstimate, type FramePlane, type PoseModel } from '@/lib/spatial-reconstruction/pose-network/pose-model'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface OnnxPoseSession {
  /** Шесть чисел: tx, ty, tz в миллиметрах и rx, ry, rz в радианах. Кадр fromFrame выражен в кадре toFrame. */
  runPair(previous: FramePlane, current: FramePlane): ArrayLike<number>
}

export function poseModelFromOnnx(session: OnnxPoseSession, confidence: number | null = null, id = 'tus-rec-onnx'): PoseModel {
  return {
    id,
    domain: 'forearm-tus-rec',
    predictPair(previous, current) {
      const values = session.runPair(previous, current)
      if (values.length < 6) throw new Error('Сеть позы вернула не 6 степеней свободы.')
      const numbers = [0, 1, 2, 3, 4, 5].map((index) => values[index])
      if (numbers.some((value) => !Number.isFinite(value))) throw new Error('Сеть позы вернула нечисловую позу.')
      const translationMm: Vec3 = [numbers[0], numbers[1], numbers[2]]
      const rotationRad: Vec3 = [numbers[3], numbers[4], numbers[5]]
      return poseEstimate(1, translationMm, rotationRad, confidence)
    },
  }
}
