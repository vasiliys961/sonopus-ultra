import type { PoseEstimate, Vec3 } from '@/lib/spatial-reconstruction/types'

export interface FramePlane {
  gray: Float32Array
  width: number
  height: number
}

export interface PoseModel {
  id: string
  /** Предплечье TUS-REC — единственный домен, для которого заявлен baseline. Клинические цели сюда не входят. */
  domain: 'forearm-tus-rec'
  predictPair(previous: FramePlane, current: FramePlane): PoseEstimate
}

export function requirePoseModel(model: PoseModel | null): PoseModel {
  if (!model) {
    throw new Error('Сеть позы не подключена. Веса TUS-REC не приложены, смещение кадра не выдумывается.')
  }
  return model
}

export function poseEstimate(fromFrame: number, translationMm: Vec3, rotationRad: Vec3, confidence: number | null): PoseEstimate {
  return {
    fromFrame,
    toFrame: fromFrame - 1,
    translationMm,
    rotationRad,
    confidence,
    source: 'pose-network',
  }
}
