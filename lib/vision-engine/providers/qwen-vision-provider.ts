import type { LlmClient } from '@/lib/llm-pipeline/llm-client'
import { createGeminiVisionProvider } from '@/lib/vision-engine/providers/gemini-vision-provider'
import type { VisionProvider } from '@/lib/vision-engine/providers/vision-provider'

/** Тот же контракт, что у Gemini. Отдельной библиотеки Qwen нет: модель задаётся строкой. */
export function createQwenVisionProvider(options: { client: LlmClient; model: string; prompt?: string }): VisionProvider {
  return { ...createGeminiVisionProvider(options), id: 'qwen', model: options.model }
}
