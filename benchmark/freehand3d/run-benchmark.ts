import { CONTROLLED_SHIFTS, SYNTHETIC_SHIFTS, translationMaeMm } from '@/benchmark/freehand3d/metrics'
import { reconstructFreehand, type VolumeBuildResult } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { LearnedPoseProvider } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import { ReferencePoseProvider, referenceStep } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { poseModelById } from '@/lib/volume-engine/pose/registry'
import { TUSRecPoseProvider } from '@/lib/volume-engine/pose/tus-rec/TUSRecPoseProvider'
import { shiftedPair } from '@/lib/volume-engine/phantom/shapes'

export interface BenchmarkRow {
  id: string
  provider: 'reference' | 'registration' | 'tus-rec' | 'custom'
  translationMaeMm: number | null
  unavailable: boolean
  clinicallyValidated: false
}

function mae(result: VolumeBuildResult, truthMm: number): number | null {
  const point = result.trajectory[1]
  if (!point || result.volume.status === 'unavailable') return null
  return translationMaeMm(point.matrix[3], truthMm)
}

export async function runFreehandBenchmark(): Promise<BenchmarkRow[]> {
  const descriptor = poseModelById('tus-rec-2024')
  if (!descriptor) throw new Error('в реестре нет tus-rec-2024')
  const rows: BenchmarkRow[] = []
  for (let index = 0; index < SYNTHETIC_SHIFTS.length; index += 1) {
    const truth = SYNTHETIC_SHIFTS[index] ?? 0
    const frames = shiftedPair(truth)
    const reference = await reconstructFreehand(frames, new ReferencePoseProvider([referenceStep([truth, 0, 0])]), DEFAULT_FREEHAND_CONFIG)
    rows.push({
      id: `synthetic-${index}`,
      provider: 'reference',
      translationMaeMm: mae(reference, truth),
      unavailable: reference.volume.status === 'unavailable',
      clinicallyValidated: false,
    })
  }
  for (let index = 0; index < CONTROLLED_SHIFTS.length; index += 1) {
    const truth = CONTROLLED_SHIFTS[index] ?? 0
    const frames = shiftedPair(truth)
    const registration = await reconstructFreehand(
      frames,
      new RegistrationPoseProvider(),
      { ...DEFAULT_FREEHAND_CONFIG, poseProvider: 'registration' },
    )
    rows.push({
      id: `controlled-${index}`,
      provider: 'registration',
      translationMaeMm: mae(registration, truth),
      unavailable: false,
      clinicallyValidated: false,
    })
  }
  const tusFrames = shiftedPair(2)
  const tus = await reconstructFreehand(
    tusFrames,
    new TUSRecPoseProvider(descriptor, null),
    { ...DEFAULT_FREEHAND_CONFIG, poseProvider: 'learned', learnedModel: 'tus-rec-2024' },
  )
  rows.push({
    id: 'tus-rec',
    provider: 'tus-rec',
    translationMaeMm: null,
    unavailable: tus.error === 'POSE_MODEL_UNAVAILABLE',
    clinicallyValidated: false,
  })
  const custom = await reconstructFreehand(
    tusFrames,
    new LearnedPoseProvider('custom-sonopus-pose-v1', null),
    { ...DEFAULT_FREEHAND_CONFIG, poseProvider: 'learned', learnedModel: 'custom-sonopus-pose-v1' },
  )
  rows.push({
    id: 'custom-untrained',
    provider: 'custom',
    translationMaeMm: null,
    unavailable: custom.error === 'POSE_MODEL_UNAVAILABLE',
    clinicallyValidated: false,
  })
  return rows
}
