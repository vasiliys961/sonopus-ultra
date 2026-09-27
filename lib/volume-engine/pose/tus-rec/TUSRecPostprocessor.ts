import { readSixDof } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import type { PoseEstimate } from '@/lib/volume-engine/pose/PoseProvider'
import type { PoseModelDescriptor } from '@/lib/volume-engine/pose/registry'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

/** Шесть чисел: tx ty tz в миллиметрах, rx ry rz в радианах. Другие единицы не пересчитываются. */
export function postprocessTusRec(values: ArrayLike<number>, descriptor: PoseModelDescriptor): PoseEstimate {
  if (!descriptor.units || descriptor.units.translation !== 'mm' || descriptor.units.rotation !== 'rad') {
    throw new VolumeEngineError('UNSUPPORTED_MODEL', 'Единицы выхода TUS-REC не подтверждены.')
  }
  return readSixDof(values)
}
