import { z } from 'zod'
import type { DiagnosticResult } from '@/lib/domain/types'
import { base64ToBytes } from '@/lib/image/base64'
import type { DiagnoseCommand } from '@/lib/pipeline/diagnose'

const dims = z.object({
  depthMm: z.number().finite(),
  widthMm: z.number().finite(),
  heightMm: z.number().finite(),
})

const point = z.object({ x: z.number().finite(), y: z.number().finite() })

export const diagnoseBodySchema = z.object({
  studyId: z.string().trim().min(1).max(80),
  moduleId: z.string().trim().min(1).max(40),
  question: z.string().trim().min(1).max(2000),
  bodyRegion: z
    .object({
      name: z.string().trim().min(1).max(120),
      confirmedByOperator: z.boolean(),
    })
    .optional(),
  views: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        evidenceIds: z.array(z.string().min(1).max(80)).max(16),
        operatorConfirmed: z.boolean(),
        qualityScore: z.number().min(0).max(1),
      }),
    )
    .max(12),
  calibration: z.union([
    z.object({
      status: z.literal('verified'),
      mmPerPixel: z.number().positive().max(20),
      source: z.literal('dicom-pixel-spacing'),
    }),
    z.object({
      status: z.literal('verified'),
      source: z.literal('device-calipers'),
      attestedByOperator: z.literal(true),
    }),
    z.object({
      status: z.literal('unavailable'),
      reason: z.string().trim().min(1).max(300),
    }),
  ]),
  manual: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('bladder'), depthMm: z.number(), widthMm: z.number(), heightMm: z.number() }),
      z.object({ kind: z.literal('ivc'), diametersMm: z.array(z.number()).min(2).max(80) }),
      z.object({
        kind: z.literal('efast'),
        points: z.object({
          RUQ: z.boolean().nullable(),
          LUQ: z.boolean().nullable(),
          pelvis: z.boolean().nullable(),
          subxiphoid: z.boolean().nullable(),
        }),
      }),
      z.object({ kind: z.literal('lung'), zoneCounts: z.record(z.string(), z.number()).refine((value) => Object.keys(value).length <= 8) }),
      z.object({ kind: z.literal('thyroid'), left: dims, right: dims }),
      z.object({
        kind: z.literal('cardiac-ef'),
        edvMl: z.number().optional(),
        esvMl: z.number().optional(),
        a4cDiastole: z.array(point).max(64).optional(),
        a4cSystole: z.array(point).max(64).optional(),
        a2cDiastole: z.array(point).max(64).optional(),
        a2cSystole: z.array(point).max(64).optional(),
      }),
    ])
    .optional(),
  frames: z
    .array(
      z.object({
        evidenceId: z.string().trim().min(1).max(80),
        timestamp: z.number().finite(),
        sequenceNumber: z.number().int().nonnegative(),
        width: z.number().int().min(16).max(640),
        height: z.number().int().min(16).max(640),
        rgbaBase64: z.string().min(8).max(1_400_000),
        qualityScore: z.number().min(0).max(1),
      }),
    )
    .max(16),
  diameterSeriesPx: z.array(z.number().positive()).max(80).optional(),
  sourceType: z.enum(['uvc', 'hdmi', 'dicom', 'screen-capture', 'synthetic']),
  operatorNote: z.string().max(12000).optional(),
  reportLanguage: z.enum(['en', 'ru', 'es', 'fr', 'ar', 'hi', 'pt-BR', 'id', 'ms', 'tr', 'zh-CN']).optional(),
  previousResult: z.any().optional(),
})

function isDiagnosticResult(value: unknown): value is DiagnosticResult {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DiagnosticResult>
  return record.schemaVersion === '1.0' && typeof record.studyId === 'string' && Array.isArray(record.differential)
}

export function commandFromBody(body: z.infer<typeof diagnoseBodySchema>): DiagnoseCommand {
  return {
    studyId: body.studyId,
    moduleId: body.moduleId,
    question: body.question,
    bodyRegion: body.bodyRegion,
    views: body.views,
    calibration: body.calibration,
    manual: body.manual,
    diameterSeriesPx: body.diameterSeriesPx,
    sourceType: body.sourceType,
    operatorNote: body.operatorNote,
    reportLanguage: body.reportLanguage,
    previousResult: isDiagnosticResult(body.previousResult) ? body.previousResult : null,
    frames: body.frames.map((frame) => {
      const bytes = base64ToBytes(frame.rgbaBase64)
      if (bytes.length !== frame.width * frame.height * 4) {
        throw new Error(`кадр ${frame.evidenceId} не совпадает с заявленным размером`)
      }
      return {
        evidenceId: frame.evidenceId,
        timestamp: frame.timestamp,
        sequenceNumber: frame.sequenceNumber,
        qualityScore: frame.qualityScore,
        raster: { width: frame.width, height: frame.height, data: new Uint8ClampedArray(bytes) },
      }
    }),
  }
}
