import type { FramePlane } from '@/lib/volume-engine/pose/PoseProvider'
import type { PoseModelDescriptor } from '@/lib/volume-engine/pose/registry'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import { inspectTusRec } from '@/lib/volume-engine/pose/tus-rec/TUSRecConfig'

/** Не меняет размер кадра наугад. Несовпадение входа — отказ, не подгонка. */
export function preprocessTusRec(frame: FramePlane, descriptor: PoseModelDescriptor): Float32Array {
  const inspection = inspectTusRec(descriptor)
  if (!inspection.usable || descriptor.inputWidth == null || descriptor.inputHeight == null) {
    throw new VolumeEngineError('UNSUPPORTED_MODEL', `TUS-REC не проверен: ${inspection.missing.join(', ')}`)
  }
  if (frame.width !== descriptor.inputWidth || frame.height !== descriptor.inputHeight) {
    throw new VolumeEngineError('UNSUPPORTED_MODEL', 'Размер кадра не совпадает с проверенным входом модели.')
  }
  return frame.gray
}
