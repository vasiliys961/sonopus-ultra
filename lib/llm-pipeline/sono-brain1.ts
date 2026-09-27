import type { Observation } from '@/lib/domain/types'
import type { LlmClient, LlmImage } from '@/lib/llm-pipeline/llm-client'
import { parseObservations } from '@/lib/llm-pipeline/parse-model-output'
import { BRAIN1_PROMPT_VERSION, brain1SystemPrompt, brain1UserPrompt } from '@/lib/prompts/ultrasound-entity-extraction'

export interface Brain1Request {
  model: string
  question: string
  moduleTitle: string
  measurement: unknown
  evidenceIds: string[]
  images: LlmImage[]
  operatorNote?: string
}

export async function runBrain1(client: LlmClient, request: Brain1Request): Promise<Observation[]> {
  try {
    const text = await client.completeJson({
      model: request.model,
      system: brain1SystemPrompt(),
      user: brain1UserPrompt(request),
      images: request.images,
    })
    return parseObservations(text, new Set(request.evidenceIds))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'сбой Brain 1'
    throw new Error(`Brain 1: ${message}`)
  }
}

export { BRAIN1_PROMPT_VERSION }
