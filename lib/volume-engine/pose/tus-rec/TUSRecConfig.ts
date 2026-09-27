import type { PoseModelDescriptor } from '@/lib/volume-engine/pose/registry'

export interface TusRecInspection {
  usable: boolean
  missing: string[]
}

const REQUIRED = ['checkpoint', 'license', 'inputWidth', 'inputHeight', 'units', 'outputType'] as const

/** Checkpoint можно подключать только когда известны архитектура, вход, выход, единицы и лицензия. */
export function inspectTusRec(descriptor: PoseModelDescriptor): TusRecInspection {
  const missing: string[] = []
  if (!descriptor.checkpoint) missing.push('checkpoint')
  if (!descriptor.license) missing.push('license')
  if (descriptor.inputWidth == null || descriptor.inputHeight == null) missing.push('input size')
  if (!descriptor.units) missing.push('units')
  if (descriptor.outputType !== '6dof') missing.push('output format')
  if (descriptor.units && (descriptor.units.translation !== 'mm' || descriptor.units.rotation !== 'rad')) missing.push('coordinate convention')
  if (descriptor.provider !== 'tus-rec') missing.push('architecture')
  return { usable: missing.length === 0, missing }
}

export function tusRecChecklist(): readonly string[] {
  return REQUIRED
}

export type TusRecReadiness = 'NOT CONNECTED' | 'ADAPTER READY' | 'MODEL CONNECTED' | 'MODEL BENCHMARKED'

/** Без checkpoint статус не поднимается выше отсутствия модели. Прогон весов здесь не подменяется. */
export function tusRecReadiness(descriptor: PoseModelDescriptor, sessionConnected: boolean): TusRecReadiness {
  const inspection = inspectTusRec(descriptor)
  if (!inspection.usable || !sessionConnected) return 'NOT CONNECTED'
  return 'MODEL CONNECTED'
}
