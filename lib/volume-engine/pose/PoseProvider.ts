import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface FramePlane {
  gray: Float32Array
  width: number
  height: number
  pixelSpacingX: number | null
  pixelSpacingY: number | null
}

export interface PoseEstimate {
  translationMm: Vec3
  rotationRad: Vec3
  confidence: number
}

export type PoseProviderMode = 'reference' | 'sensor' | 'registration' | 'learned'

export interface PoseProvider {
  readonly id: string
  readonly mode: PoseProviderMode
  estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate>
}
