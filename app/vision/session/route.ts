import { NextResponse } from 'next/server'
import { getOrganModule } from '@/lib/ultrasound-modules/registry'
import { createServerVisionEngine } from '@/lib/vision-engine/server-engine'
import { openVisionSession } from '@/lib/vision-engine/session-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { studyId?: string; moduleId?: string }
  try {
    body = (await request.json()) as { studyId?: string; moduleId?: string }
  } catch {
    return NextResponse.json({ error: 'Тело запроса не JSON.' }, { status: 400 })
  }
  if (!body.studyId || !body.moduleId || !getOrganModule(body.moduleId)) {
    return NextResponse.json({ error: 'Нужны studyId и известный модуль.' }, { status: 400 })
  }
  const created = createServerVisionEngine()
  const session = openVisionSession({
    id: crypto.randomUUID(),
    studyId: body.studyId,
    moduleId: body.moduleId,
    engine: created.engine,
    cloudNote: created.cloudNote,
  })
  return NextResponse.json({ id: session.id, studyId: session.studyId, moduleId: session.moduleId })
}
