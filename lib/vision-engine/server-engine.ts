import { readLlmConfig } from '@/lib/llm-pipeline/config'
import { createOpenRouterClient } from '@/lib/llm-pipeline/llm-client'
import { heuristicQualityScorer } from '@/lib/quality/heuristic-quality-scorer'
import { createGeminiVisionProvider } from '@/lib/vision-engine/providers/gemini-vision-provider'
import { VisionEngine } from '@/lib/vision-engine/vision-engine'

export function createServerVisionEngine(env: NodeJS.ProcessEnv = process.env): { engine: VisionEngine; cloudNote: string | null } {
  const config = readLlmConfig(env)
  const shared = { minStableMs: 0, fastLoopFps: 10, visionLoopFps: 2 }
  if (!config.apiKey) {
    return { engine: new VisionEngine(heuristicQualityScorer, null, shared), cloudNote: 'облако не настроено' }
  }
  const provider = createGeminiVisionProvider({
    client: createOpenRouterClient({ apiKey: config.apiKey, baseUrl: config.baseUrl }),
    model: env.VISION_MODEL || 'google/gemini-3.8-flash',
  })
  return { engine: new VisionEngine(heuristicQualityScorer, provider, { ...shared, enableCloudVision: true }), cloudNote: null }
}
