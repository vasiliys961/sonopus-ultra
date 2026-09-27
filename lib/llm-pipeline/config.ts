export interface LlmRuntimeConfig {
  apiKey: string
  baseUrl: string
  brain1Model: string
  brain2Model: string
  doctorOpusUrl: string
}

export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmRuntimeConfig {
  return {
    apiKey: env.OPENROUTER_API_KEY ?? '',
    baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    brain1Model: env.BRAIN1_MODEL ?? 'google/gemini-3.8',
    brain2Model: env.BRAIN2_MODEL ?? 'anthropic/claude-sonnet',
    doctorOpusUrl: env.DOCTOR_OPUS_FORWARD_URL ?? '',
  }
}
