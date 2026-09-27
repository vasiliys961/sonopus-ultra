import { NextResponse } from 'next/server'
import { inspectDicomBuffer } from '@/lib/dicom/pixel-spacing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length < 132 || bytes.length > 30_000_000) {
    return NextResponse.json({ calibration: 'unavailable', reason: 'файл пустой или слишком большой' }, { status: 400 })
  }
  return NextResponse.json(inspectDicomBuffer(bytes))
}
