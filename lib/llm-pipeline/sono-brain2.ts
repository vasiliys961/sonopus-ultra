import type { LlmClient, LlmImage } from '@/lib/llm-pipeline/llm-client'
import { parseProposals, parseSonographerReport, type ProposedDiagnosis } from '@/lib/llm-pipeline/parse-model-output'
import { BRAIN2_PROMPT_VERSION, brain2SystemPrompt, brain2UserPrompt } from '@/lib/prompts/sonographer-differential'

export interface Brain2Request {
  model: string
  question: string
  bodyRegion?: { name: string; confirmedByOperator: boolean }
  views: Array<{ name: string; evidenceIds: string[]; operatorConfirmed: boolean }>
  observations: unknown
  measurement: unknown
  operatorNote?: string
  reportLanguage?: string
  protocolOutline?: string
  protocolReference?: string
  images?: LlmImage[]
}

export interface Brain2Draft {
  proposals: ProposedDiagnosis[]
  report?: string
}

export async function runBrain2(client: LlmClient, request: Brain2Request): Promise<Brain2Draft> {
  try {
    const patientFields = {
      question: request.question,
      bodyRegion: request.bodyRegion,
      views: request.views,
      observations: request.observations,
      measurement: request.measurement,
      operatorNote: request.operatorNote,
      reportLanguage: request.reportLanguage,
      protocolOutline: request.protocolOutline,
    }
    const user = brain2UserPrompt({ ...patientFields, protocolReference: request.protocolReference })
    const text = await client.completeJson({
      model: request.model,
      system: brain2SystemPrompt(),
      user,
      images: request.images,
    })
    return { proposals: parseProposals(text), report: parseSonographerReport(text, brain2UserPrompt(patientFields)) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'сбой Brain 2'
    throw new Error(`Brain 2: ${message}`)
  }
}

export { BRAIN2_PROMPT_VERSION }
