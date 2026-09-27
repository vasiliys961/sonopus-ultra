import { NextResponse } from 'next/server'
import { clipForSession } from '@/lib/vision-engine/session-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { sessionId?: string; startTime?: number; endTime?: number }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Тело запроса не JSON.' }, { status: 400 })
  }
  if (!body.sessionId || body.startTime === undefined || body.endTime === undefined) {
    return NextResponse.json({ error: 'Нужны сессия и границы клипа.' }, { status: 400 })
  }
  try {
    const clip = clipForSession(body.sessionId, body.startTime, body.endTime)
    return NextResponse.json({ clip })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'клип не собран' }, { status: 404 })
  }
}
