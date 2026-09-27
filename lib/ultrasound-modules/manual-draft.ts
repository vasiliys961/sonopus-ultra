import type { ManualMeasurement, Point } from '@/lib/domain/types'
import { EFAST_POINTS } from '@/lib/ultrasound-modules/efast/efast-module'
import { LUNG_ZONES } from '@/lib/ultrasound-modules/lung/lung-module'

export interface TripleDraft {
  depthMm: string
  widthMm: string
  heightMm: string
}

export interface MeasurementDraft {
  bladder: TripleDraft
  ivcDiameters: string
  efast: Record<(typeof EFAST_POINTS)[number], boolean | null>
  lungZones: Record<string, string>
  thyroidLeft: TripleDraft
  thyroidRight: TripleDraft
  edvMl: string
  esvMl: string
  contours: {
    a4cDiastole: Point[]
    a4cSystole: Point[]
    a2cDiastole: Point[]
    a2cSystole: Point[]
  }
}

export function emptyDraft(): MeasurementDraft {
  const triple = (): TripleDraft => ({ depthMm: '', widthMm: '', heightMm: '' })
  return {
    bladder: triple(),
    ivcDiameters: '',
    efast: { RUQ: null, LUQ: null, pelvis: null, subxiphoid: null },
    lungZones: Object.fromEntries(LUNG_ZONES.map((zone) => [zone, ''])),
    thyroidLeft: triple(),
    thyroidRight: triple(),
    edvMl: '',
    esvMl: '',
    contours: { a4cDiastole: [], a4cSystole: [], a2cDiastole: [], a2cSystole: [] },
  }
}

function readNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function readTriple(draft: TripleDraft): { depthMm: number; widthMm: number; heightMm: number } | null {
  const depthMm = readNumber(draft.depthMm)
  const widthMm = readNumber(draft.widthMm)
  const heightMm = readNumber(draft.heightMm)
  if (depthMm === null || widthMm === null || heightMm === null) return null
  return { depthMm, widthMm, heightMm }
}

export function draftToManual(moduleId: string, draft: MeasurementDraft): ManualMeasurement | undefined {
  if (moduleId === 'bladder') {
    const size = readTriple(draft.bladder)
    return size ? { kind: 'bladder', ...size } : undefined
  }
  if (moduleId === 'ivc') {
    const diametersMm = draft.ivcDiameters
      .split(/[\s,;]+/)
      .map((item) => readNumber(item))
      .filter((item): item is number => item !== null)
    return diametersMm.length >= 2 ? { kind: 'ivc', diametersMm } : undefined
  }
  if (moduleId === 'efast') return { kind: 'efast', points: { ...draft.efast } }
  if (moduleId === 'lung') {
    const zoneCounts: Record<string, number> = {}
    for (const zone of LUNG_ZONES) {
      const count = readNumber(draft.lungZones[zone] ?? '')
      if (count === null) return undefined
      zoneCounts[zone] = count
    }
    return { kind: 'lung', zoneCounts }
  }
  if (moduleId === 'thyroid') {
    const left = readTriple(draft.thyroidLeft)
    const right = readTriple(draft.thyroidRight)
    return left && right ? { kind: 'thyroid', left, right } : undefined
  }
  if (moduleId === 'cardiac-ef') {
    const edvMl = readNumber(draft.edvMl)
    const esvMl = readNumber(draft.esvMl)
    const contours = draft.contours
    const hasContour = Object.values(contours).some((points) => points.length > 0)
    if (edvMl === null && esvMl === null && !hasContour) return undefined
    return {
      kind: 'cardiac-ef',
      edvMl: edvMl ?? undefined,
      esvMl: esvMl ?? undefined,
      ...contours,
    }
  }
  return undefined
}
