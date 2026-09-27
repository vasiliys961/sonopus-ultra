import { preprocessTusRec } from '@/lib/volume-engine/pose/tus-rec/TUSRecPreprocessor'
import { postprocessTusRec } from '@/lib/volume-engine/pose/tus-rec/TUSRecPostprocessor'
import type { OnnxPoseSession } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import type { FramePlane, PoseEstimate } from '@/lib/volume-engine/pose/PoseProvider'
import type { PoseModelDescriptor } from '@/lib/volume-engine/pose/registry'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import { inspectTusRec } from '@/lib/volume-engine/pose/tus-rec/TUSRecConfig'

export async function adaptTusRecPair(
  descriptor: PoseModelDescriptor,
  session: OnnxPoseSession | null,
  previous: FramePlane,
  current: FramePlane,
): Promise<PoseEstimate> {
  const inspection = inspectTusRec(descriptor)
  if (!inspection.usable || !session) {
    throw new VolumeEngineError('POSE_MODEL_UNAVAILABLE', `TUS-REC не подключён: ${inspection.missing.join(', ') || 'нет сессии'}`)
  }
  preprocessTusRec(previous, descriptor)
  preprocessTusRec(current, descriptor)
  const values = await session.runPair(previous, current)
  return postprocessTusRec(values, descriptor)
}
