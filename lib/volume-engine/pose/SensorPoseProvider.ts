import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'

/** Показание внешнего трекера. Без устройства поза не выдумывается. */
export interface SensorReading {
  translationMm: PoseEstimate['translationMm']
  rotationRad: PoseEstimate['rotationRad']
  confidence: number
}

export interface SensorSource {
  readPair(previous: FramePlane, current: FramePlane): SensorReading | null
}

export class SensorPoseProvider implements PoseProvider {
  readonly id = 'sensor'
  readonly mode = 'sensor' as const

  constructor(private readonly source: SensorSource | null) {}

  async estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate> {
    if (!this.source) {
      throw new VolumeEngineError('POSE_MODEL_UNAVAILABLE', 'Датчик позы не подключён.')
    }
    const reading = this.source.readPair(previous, current)
    if (!reading) throw new VolumeEngineError('POSE_MODEL_UNAVAILABLE', 'Датчик не вернул позу этой пары кадров.')
    return reading
  }
}
