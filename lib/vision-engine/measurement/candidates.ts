import { hasMeasurementScale, type CalibrationState } from '@/lib/domain/types'

export interface MeasurementCandidate {
  structure: string
  value?: number
  unit?: 'mm' | 'cm' | 'ml' | '%'
  confidence: number
  sourceFrameIds: string[]
  scaleConfirmed: boolean
  validationStatus: 'candidate' | 'validated' | 'rejected'
}

export function reviewCandidate(input: {
  structure: string
  value?: number
  unit?: MeasurementCandidate['unit']
  confidence: number
  sourceFrameIds: string[]
  calibration: CalibrationState
}): MeasurementCandidate {
  const scaleConfirmed = hasMeasurementScale(input.calibration)
  const base = {
    structure: input.structure,
    unit: input.unit,
    confidence: input.confidence,
    sourceFrameIds: input.sourceFrameIds,
    scaleConfirmed,
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0.3 || (input.value !== undefined && input.value <= 0)) {
    return { ...base, validationStatus: 'rejected' }
  }
  if (input.value === undefined || !scaleConfirmed) {
    return { ...base, validationStatus: 'candidate' }
  }
  return { ...base, value: input.value, validationStatus: 'validated' }
}
