import { NextResponse } from 'next/server'
import { readLlmConfig } from '@/lib/llm-pipeline/config'
import { createOpenRouterClient } from '@/lib/llm-pipeline/llm-client'
import { runDiagnosticPipeline } from '@/lib/pipeline/diagnose'
import { commandFromBody, diagnoseBodySchema } from '@/lib/pipeline/schema'
import { shellResult } from '@/lib/pipeline/result'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json(shellResult('unknown', '', 'error', ['Тело запроса не JSON.']), { status: 400 })
  }
  const parsed = diagnoseBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(shellResult('unknown', '', 'error', ['Запрос не прошёл проверку полей.']), { status: 400 })
  }
  try {
    const config = readLlmConfig()
    const client = createOpenRouterClient({ apiKey: config.apiKey, baseUrl: config.baseUrl })
    const result = await runDiagnosticPipeline(commandFromBody(parsed.data), {
      brain1: client,
      brain2: client,
      brain1Model: config.brain1Model,
      brain2Model: config.brain2Model,
    })
    return NextResponse.json(result)
  } catch (error) {
    const studyId = parsed.data.studyId
    const question = parsed.data.question
    return NextResponse.json(
      shellResult(studyId, question, 'error', [error instanceof Error ? error.message : 'сбой разбора']),
      { status: 400 },
    )
  }
}
