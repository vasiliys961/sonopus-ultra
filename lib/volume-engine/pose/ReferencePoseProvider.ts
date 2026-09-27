import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'

/** Только тесты, фантом и регрессия. Клинических утверждений здесь нет. */
export class ReferencePoseProvider implements PoseProvider {
  readonly id = 'reference'
  readonly mode = 'reference' as const
  private cursor = 0

  constructor(private readonly script: readonly PoseEstimate[]) {}

  async estimate(_previous: FramePlane, _current: FramePlane): Promise<PoseEstimate> {
    const step = this.script[this.cursor]
    this.cursor += 1
    if (!step) throw new VolumeEngineError('POSE_MODEL_UNAVAILABLE', 'Эталонная поза для этой пары кадров не задана.')
    return step
  }
}

export function referenceStep(translationMm: Vec3, rotationRad: Vec3 = [0, 0, 0]): PoseEstimate {
    return {
      translationMm,
      rotationRad,
      confidence: 1,
      translationAxes: ['known', 'known', 'known'],
      rotationAxes: ['known', 'known', 'known'],
      method: 'reference',
    }
}
