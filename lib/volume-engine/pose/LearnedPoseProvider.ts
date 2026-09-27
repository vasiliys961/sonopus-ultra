import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface OnnxPoseSession {
  runPair(previous: FramePlane, current: FramePlane): Promise<ArrayLike<number>> | ArrayLike<number>
}

export function readSixDof(values: ArrayLike<number>): PoseEstimate {
  if (values.length < 6) throw new VolumeEngineError('UNSUPPORTED_MODEL', 'Сеть позы вернула не 6 степеней свободы.')
  const numbers = [0, 1, 2, 3, 4, 5].map((index) => values[index] ?? Number.NaN)
  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new VolumeEngineError('UNSUPPORTED_MODEL', 'Сеть позы вернула нечисловую позу.')
  }
  const translationMm: Vec3 = [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0]
  const rotationRad: Vec3 = [numbers[3] ?? 0, numbers[4] ?? 0, numbers[5] ?? 0]
  return {
    translationMm,
    rotationRad,
    confidence: 1,
    translationAxes: ['known', 'known', 'known'],
    rotationAxes: ['known', 'known', 'known'],
    method: 'learned-6dof',
  }
}

/** Адаптер learned-позы. Без сессии смещение не подставляется. */
export class LearnedPoseProvider implements PoseProvider {
  readonly mode = 'learned' as const

  constructor(
    readonly id: string,
    private readonly session: OnnxPoseSession | null,
  ) {}

  async estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate> {
    if (!this.session) throw new VolumeEngineError('POSE_MODEL_UNAVAILABLE', 'Сеть позы не подключена. Смещение кадра не выдумывается.')
    const values = await this.session.runPair(previous, current)
    return readSixDof(values)
  }
}
