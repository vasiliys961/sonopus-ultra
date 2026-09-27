import { NextResponse } from 'next/server'
import { z } from 'zod'
import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'
import { base64ToBytes, bytesToBase64 } from '@/lib/image/base64'
import { encodePng } from '@/lib/image/png-encode'
import { readLlmConfig } from '@/lib/llm-pipeline/config'
import { createOpenRouterClient } from '@/lib/llm-pipeline/llm-client'
import { parseKeepIds, pickPrompt } from '@/lib/ultra/pick-frames'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  organ: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(8),
  frames: z.array(z.object({
    evidenceId: z.string().trim().min(1).max(80),
    width: z.number().int().min(16).max(640),
    height: z.number().int().min(16).max(640),
    rgbaBase64: z.string().min(8).max(1_400_000),
  })).min(1).max(8),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ keep: [] })
  const allowed = new Set(parsed.data.frames.map((frame) => frame.evidenceId))
  try {
    const config = readLlmConfig()
    const client = createOpenRouterClient({ apiKey: config.apiKey, baseUrl: config.baseUrl })
    const images = parsed.data.frames.map((frame) => {
      const bytes = base64ToBytes(frame.rgbaBase64)
      if (bytes.length !== frame.width * frame.height * 4) throw new Error('размер кадра')
      const raster = anonymizeRaster({ width: frame.width, height: frame.height, data: new Uint8ClampedArray(bytes) })
      return { mimeType: 'image/png' as const, base64: bytesToBase64(encodePng(raster)) }
    })
    const text = await client.completeJson({
      model: config.brain1Model,
      system: 'Отбираешь показательные кадры ультразвукового исследования. Ответ — только JSON.',
      user: pickPrompt(parsed.data.organ, [...allowed], parsed.data.limit),
      images,
    })
    return NextResponse.json({ keep: parseKeepIds(text, allowed, parsed.data.limit) })
  } catch {
    return NextResponse.json({ keep: [] })
  }
}
