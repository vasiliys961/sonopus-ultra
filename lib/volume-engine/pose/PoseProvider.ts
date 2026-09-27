import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface FramePlane {
  gray: Float32Array
  width: number
  height: number
  pixelSpacingX: number | null
  pixelSpacingY: number | null
}

export type AxisKnowledge = 'known' | 'unknown'

export interface PoseEstimate {
  translationMm: Vec3
  rotationRad: Vec3
  confidence: number
  /** Неизвестная ось хранит 0 и не считается измерением. */
  translationAxes?: [AxisKnowledge, AxisKnowledge, AxisKnowledge]
  rotationAxes?: [AxisKnowledge, AxisKnowledge, AxisKnowledge]
  method?: 'reference' | '2d-in-plane' | 'sensor' | 'learned-6dof'
}

export type PoseProviderMode = 'reference' | 'sensor' | 'registration' | 'learned'

export interface PoseProvider {
  readonly id: string
  readonly mode: PoseProviderMode
  estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate>
}
