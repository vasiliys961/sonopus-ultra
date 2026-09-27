import { NextResponse } from 'next/server'
import { frameFromRgba } from '@/lib/vision-engine/frame-codec'
import { ingestVisionFrame } from '@/lib/vision-engine/session-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: {
    sessionId?: string
    sequenceNumber?: number
    timestamp?: number
    width?: number
    height?: number
    rgbaBase64?: string
    confirmedViews?: string[]
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Тело запроса не JSON.' }, { status: 400 })
  }
  if (!body.sessionId || body.rgbaBase64 === undefined || body.width === undefined || body.height === undefined) {
    return NextResponse.json({ error: 'Нужны сессия и кадр.' }, { status: 400 })
  }
  try {
    const frame = frameFromRgba({
      sequenceNumber: body.sequenceNumber ?? 0,
      timestamp: body.timestamp ?? 0,
      width: body.width,
      height: body.height,
      rgbaBase64: body.rgbaBase64,
    })
    const result = await ingestVisionFrame({
      sessionId: body.sessionId,
      frame,
      confirmedViews: body.confirmedViews ?? [],
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'кадр не принят'
    const status = message.includes('не найдена') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
