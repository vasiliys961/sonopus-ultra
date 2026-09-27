import type { MeasurementResult } from '@/lib/domain/types'

export function bladderFindings(result: MeasurementResult): Record<string, unknown> {
  return {
    volume_ml: result.value,
    view_transverse_quality: result.raw.view_transverse_quality ?? null,
    view_longitudinal_quality: result.raw.view_longitudinal_quality ?? null,
    confidence: result.value === undefined ? 'unavailable' : 'measurement',
    calibration: result.calibration,
    formulaSource: result.formulaSource,
    clinicallyValidated: result.clinicallyValidated,
    reason: result.raw.reason ?? null,
  }
}
