import type { DiagnosticResult, SonoStudyPayload, SourceType } from '@/lib/domain/types'
import { SOURCE_TRUST } from '@/lib/device-hub/types'
import { readyToForward } from '@/lib/diagnostic-arbiter/review'

export function buildSonoPayload(input: {
  result: DiagnosticResult
  sourceType: SourceType
  findings: Record<string, unknown>
  calibration: 'verified' | 'unavailable'
  patientRef?: string
}): SonoStudyPayload {
  return {
    studyId: input.result.studyId,
    patientRef: input.patientRef,
    createdAt: new Date().toISOString(),
    modality: 'ultrasound',
    payloadType: 'image',
    measurements: {
      diagnosticResult: input.result,
      sourceType: input.sourceType,
      sourceTrustLevel: SOURCE_TRUST[input.sourceType],
      calibration: input.calibration,
      findings: input.findings,
    },
  }
}

export function assertForwardable(result: DiagnosticResult, sourceType: SourceType): { ok: true } | { ok: false; reason: string } {
  if (sourceType === 'synthetic') return { ok: false, reason: 'синтетический источник не передаётся в карту пациента' }
  return readyToForward(result)
}
