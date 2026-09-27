import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readLlmConfig } from '@/lib/llm-pipeline/config'
import { createOpenRouterClient } from '@/lib/llm-pipeline/llm-client'
import { medicalLanguagePrompt, parseMedicalText } from '@/lib/ultra/medical-language'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  text: z.string().trim().min(1).max(12000),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ text: '' })
  try {
    const config = readLlmConfig()
    const client = createOpenRouterClient({ apiKey: config.apiKey, baseUrl: config.baseUrl })
    const raw = await client.completeJson({
      model: config.brain1Model,
      system: 'Ты правишь язык диктовки УЗИ. Не ставишь диагноз и не добавляешь фактов. Ответ — только JSON.',
      user: medicalLanguagePrompt(parsed.data.text),
    })
    return NextResponse.json({ text: parseMedicalText(raw, parsed.data.text) })
  } catch {
    return NextResponse.json({ text: parsed.data.text })
  }
}
