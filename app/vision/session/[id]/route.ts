import { NextResponse } from 'next/server'
import { getVisionSession } from '@/lib/vision-engine/session-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: { id: string } }) {
  const session = getVisionSession(context.params.id)
  if (!session) return NextResponse.json({ error: 'сессия зрения не найдена' }, { status: 404 })
  return NextResponse.json({
    id: session.id,
    studyId: session.studyId,
    moduleId: session.moduleId,
    panel: session.panel,
  })
}
