export const DIAGNOSTIC_SCHEMA_VERSION = '1.0' as const

export type Polarity = 'present' | 'absent' | 'uncertain' | 'not_assessed'
export type DiagnosisPriority = 'consider' | 'important_to_exclude' | 'most_compatible'
export type DiagnosisStatus = 'model_proposed' | 'operator_accepted' | 'operator_rejected'
export type DiagnosticOutcome =
  | 'hypotheses_available'
  | 'low_confidence_hypothesis'
  | 'insufficient_evidence'
  | 'unsupported_mode'
  | 'error'

export type SourceType = 'uvc' | 'hdmi' | 'dicom' | 'screen-capture' | 'synthetic'
export type TrustLevel = 'high' | 'medium' | 'low'
export type ScanMode = 'guided' | 'second-opinion'

export interface Raster {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export interface UltrasoundFrame {
  imageData: Raster
  timestamp: number
  sequenceNumber: number
}

export interface EvidenceRef {
  evidenceId: string
  frameTimeMs?: number
  region?: { x: number; y: number; width: number; height: number }
}

export interface Observation {
  id: string
  feature: string
  polarity: Polarity
  evidence: EvidenceRef[]
  source: 'operator' | 'model'
  reviewedByOperator: boolean
}

export interface PreliminaryDiagnosis {
  id: string
  label: string
  priority: DiagnosisPriority
  supportingObservationIds: string[]
  contradictingObservationIds: string[]
  missingEvidence: string[]
  limitations: string[]
  status: DiagnosisStatus
}

export interface StudyView {
  name: string
  evidenceIds: string[]
  operatorConfirmed: boolean
}

export interface DiagnosticResult {
  schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION
  studyId: string
  question: string
  bodyRegion?: { name: string; confirmedByOperator: boolean }
  views: StudyView[]
  observations: Observation[]
  sonographerReport?: string
  differential: PreliminaryDiagnosis[]
  outcome: DiagnosticOutcome
  qualityLimitations?: string[]
  whyCannotAssess?: string[]
  acquisitionRequests: string[]
  modelProvenance?: {
    provider: string
    model: string
    promptVersion: string
    createdAt: string
  }
  formulaSource: 'published-literature'
  clinicallyValidated: false
}

export interface QualityScore {
  sharpness: number
  brightness: number
  stability: number
  coverage: number
  qualityScore: number
}

export interface QualityScorer {
  score(
    gray: Float32Array,
    width: number,
    height: number,
    prevGray: Float32Array | null,
  ): QualityScore
}

export type CalibrationState =
  | { status: 'verified'; mmPerPixel: number; source: 'dicom-pixel-spacing' }
  | { status: 'verified'; source: 'device-calipers'; attestedByOperator: true }
  | { status: 'unavailable'; reason: string }

export interface GuidanceStep {
  view: string
  title: string
  text: string
}

export interface FrameAcceptance {
  ok: boolean
  reason?: string
}

export type ManualMeasurement =
  | {
      kind: 'bladder'
      depthMm: number
      widthMm: number
      heightMm: number
    }
  | { kind: 'ivc'; diametersMm: number[] }
  | {
      kind: 'efast'
      points: {
        RUQ: boolean | null
        LUQ: boolean | null
        pelvis: boolean | null
        subxiphoid: boolean | null
      }
    }
  | { kind: 'lung'; zoneCounts: Record<string, number> }
  | {
      kind: 'thyroid'
      left: { depthMm: number; widthMm: number; heightMm: number }
      right: { depthMm: number; widthMm: number; heightMm: number }
    }
  | {
      kind: 'cardiac-ef'
      edvMl?: number
      esvMl?: number
      a4cDiastole?: Point[]
      a4cSystole?: Point[]
      a2cDiastole?: Point[]
      a2cSystole?: Point[]
      contourSource?: 'operator' | 'model'
    }

export interface Point {
  x: number
  y: number
}

export interface MeasurementRequest {
  frames: UltrasoundFrame[]
  calibration: CalibrationState
  manual?: ManualMeasurement
  viewQuality?: Record<string, number>
  /** Диаметры в пикселях по серии, если их сняла эвристика или врач на кадре. */
  diameterSeriesPx?: number[]
}

export interface MeasurementResult {
  moduleId: string
  formulaSource: 'published-literature'
  clinicallyValidated: false
  calibration: 'verified' | 'unavailable'
  value?: number
  unit?: 'ml' | 'ratio' | 'percent' | 'count'
  raw: Record<string, unknown>
}

export interface OrganModule {
  id: string
  title: string
  defaultQuestion: string
  requiredViews: readonly string[]
  qualityThreshold: number
  /** false у счётчиков и бинарных признаков, где нет мм/мл. */
  requiresSpatialScale: boolean
  guidance: readonly GuidanceStep[]
  isFrameAcceptable(frame: UltrasoundFrame, score: QualityScore): FrameAcceptance
  computeMeasurement(request: MeasurementRequest): MeasurementResult
  toFindingsPayload(result: MeasurementResult): Record<string, unknown>
}

export interface DeviceStudyEnvelope {
  studyId: string
  patientRef?: string
  createdAt: string
}

export interface SonoStudyPayload extends DeviceStudyEnvelope {
  modality: 'ultrasound'
  payloadType: 'image'
  measurements: {
    diagnosticResult: DiagnosticResult
    sourceType: SourceType
    sourceTrustLevel: TrustLevel
    calibration: 'verified' | 'unavailable'
    findings: Record<string, unknown>
  }
}

export function hasPixelScale(
  calibration: CalibrationState,
): calibration is { status: 'verified'; mmPerPixel: number; source: 'dicom-pixel-spacing' } {
  return calibration.status === 'verified' && 'mmPerPixel' in calibration && calibration.mmPerPixel > 0
}

export function hasMeasurementScale(calibration: CalibrationState): boolean {
  return calibration.status === 'verified'
}

export function measurementBase(
  moduleId: string,
  calibration: CalibrationState,
  raw: Record<string, unknown>,
  value?: number,
  unit?: MeasurementResult['unit'],
): MeasurementResult {
  const result: MeasurementResult = {
    moduleId,
    formulaSource: 'published-literature',
    clinicallyValidated: false,
    calibration: calibration.status === 'verified' ? 'verified' : 'unavailable',
    raw,
  }
  if (value !== undefined && Number.isFinite(value)) {
    result.value = value
    result.unit = unit
  }
  return result
}
