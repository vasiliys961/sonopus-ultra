import type { Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import { LearnedPoseProvider, type OnnxPoseSession } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import type { PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { ReferencePoseProvider } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { poseModelById } from '@/lib/volume-engine/pose/registry'
import { SensorPoseProvider, type SensorSource } from '@/lib/volume-engine/pose/SensorPoseProvider'
import { TUSRecPoseProvider } from '@/lib/volume-engine/pose/tus-rec/TUSRecPoseProvider'

export interface PoseRouterDeps {
  referenceScript?: readonly PoseEstimate[]
  sensor?: SensorSource | null
  learnedSession?: OnnxPoseSession | null
}

export function createPoseProvider(config: Freehand3DConfig, deps: PoseRouterDeps = {}): PoseProvider {
  if (config.poseProvider === 'reference') return new ReferencePoseProvider(deps.referenceScript ?? [])
  if (config.poseProvider === 'registration') return new RegistrationPoseProvider()
  if (config.poseProvider === 'sensor') return new SensorPoseProvider(deps.sensor ?? null)
  const modelId = config.learnedModel ?? 'custom-sonopus-pose-v1'
  const descriptor = poseModelById(modelId)
  if (!descriptor) throw new VolumeEngineError('UNSUPPORTED_MODEL', 'Модель позы не найдена в реестре.')
  if (descriptor.provider === 'tus-rec') return new TUSRecPoseProvider(descriptor, deps.learnedSession ?? null)
  return new LearnedPoseProvider(descriptor.id, deps.learnedSession ?? null)
}
