import type { OnnxPoseSession } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import type { PoseModelDescriptor } from '@/lib/volume-engine/pose/registry'
import { adaptTusRecPair } from '@/lib/volume-engine/pose/tus-rec/TUSRecModelAdapter'

/** Адаптер TUS-REC. Без проверенного checkpoint и сессии позу не создаёт. */
export class TUSRecPoseProvider implements PoseProvider {
  readonly mode = 'learned' as const

  constructor(
    private readonly descriptor: PoseModelDescriptor,
    private readonly session: OnnxPoseSession | null,
  ) {}

  get id(): string {
    return this.descriptor.id
  }

  async estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate> {
    return adaptTusRecPair(this.descriptor, this.session, previous, current)
  }
}
