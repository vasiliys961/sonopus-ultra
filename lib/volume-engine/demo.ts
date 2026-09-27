import { reconstructFreehand } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { inspectTusRec } from '@/lib/volume-engine/pose/tus-rec/TUSRecConfig'
import { poseModelById } from '@/lib/volume-engine/pose/registry'
import { ReferencePoseProvider } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { slabFrames, shiftedPair } from '@/lib/volume-engine/phantom/shapes'
import { renderVolumeWithTrajectory } from '@/lib/volume-engine/rendering/VolumeRenderer'
import type { VolumeBuildResult } from '@/lib/volume-engine/core/VolumeEngine'
import type { TusRecInspection } from '@/lib/volume-engine/pose/tus-rec/TUSRecConfig'
import type { VolumeView } from '@/lib/volume-engine/rendering/VolumeRenderer'

export interface ExperimentalDesk {
  reference: VolumeBuildResult
  registration: VolumeBuildResult
  referenceView: VolumeView
  registrationView: VolumeView
  tusRec: TusRecInspection
}

export async function loadExperimentalDesk(): Promise<ExperimentalDesk> {
  const reference = await reconstructFreehand(slabFrames(), new ReferencePoseProvider([]), DEFAULT_FREEHAND_CONFIG)
  const registration = await reconstructFreehand(
    shiftedPair(2),
    new RegistrationPoseProvider(),
    { ...DEFAULT_FREEHAND_CONFIG, poseProvider: 'registration' },
  )
  const descriptor = poseModelById('tus-rec-2024')
  return {
    reference,
    registration,
    referenceView: renderVolumeWithTrajectory(reference.volume, reference.trajectory, slabFrames()[0]?.transform ?? null),
    registrationView: renderVolumeWithTrajectory(registration.volume, registration.trajectory),
    tusRec: inspectTusRec(descriptor ?? {
      id: 'tus-rec-2024',
      provider: 'tus-rec',
      version: '2024',
      domain: 'forearm',
      inputWidth: null,
      inputHeight: null,
      outputType: '6dof',
      units: null,
    }),
  }
}
