export interface LlmImage {
  mimeType: 'image/png'
  base64: string
}

export interface LlmCompletion {
  model: string
  system: string
  user: string
  images?: LlmImage[]
}

export interface LlmClient {
  readonly providerId: string
  completeJson(input: LlmCompletion): Promise<string>
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

export function createOpenRouterClient(options: {
  apiKey: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}): LlmClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = (options.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  return {
    providerId: 'openrouter',
    async completeJson(input) {
      if (!options.apiKey) throw new Error('LLM-провайдер не настроен')
      const userContent = input.images?.length
        ? [
            { type: 'text', text: input.user },
            ...input.images.map((image) => ({
              type: 'image_url',
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            })),
          ]
        : input.user
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: userContent },
          ],
        }),
      })
      const payload = (await response.json()) as ChatResponse
      if (!response.ok) {
        throw new Error(payload.error?.message || `провайдер вернул статус ${response.status}`)
      }
      const text = payload.choices?.[0]?.message?.content
      if (!text) throw new Error('пустой ответ модели')
      return text
    },
  }
}
