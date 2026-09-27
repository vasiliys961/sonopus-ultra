import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readLlmConfig } from '@/lib/llm-pipeline/config'
import { assertForwardable, buildSonoPayload } from '@/lib/pipeline/forward'
import type { DiagnosticResult } from '@/lib/domain/types'

const bodySchema = z.object({
  diagnosticResult: z.custom<DiagnosticResult>(),
  sourceType: z.enum(['uvc', 'hdmi', 'dicom', 'screen-capture', 'synthetic']),
  findings: z.record(z.string(), z.unknown()),
  calibration: z.enum(['verified', 'unavailable']),
  patientRef: z.string().trim().max(120).optional(),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'некорректный пакет' }, { status: 400 })
  }
  const gate = assertForwardable(parsed.data.diagnosticResult, parsed.data.sourceType)
  if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: 422 })
  const payload = buildSonoPayload({
    result: parsed.data.diagnosticResult,
    sourceType: parsed.data.sourceType,
    findings: parsed.data.findings,
    calibration: parsed.data.calibration,
    patientRef: parsed.data.patientRef,
  })
  const url = readLlmConfig().doctorOpusUrl
  if (!url) return NextResponse.json({ ok: true, forwarded: false, payload })
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return NextResponse.json({ ok: response.ok, forwarded: response.ok, status: response.status, payload })
}
