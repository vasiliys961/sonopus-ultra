import type { VisionFrameInput, VisionFrameResponse } from '@/lib/vision-engine/types'
import type { AnatomyRequest, PlaneRequest, VisionClipRequest, VisionProvider } from '@/lib/vision-engine/providers/vision-provider'

async function firstAnswer(providers: readonly VisionProvider[], run: (provider: VisionProvider) => Promise<VisionFrameResponse>): Promise<VisionFrameResponse> {
  let last = 'нет провайдера'
  for (const provider of providers) {
    try {
      return await run(provider)
    } catch (error) {
      last = error instanceof Error ? error.message : 'сбой провайдера'
    }
  }
  throw new Error(last)
}

export function createVisionRouter(providers: readonly VisionProvider[]): VisionProvider {
  return {
    id: 'router',
    model: providers.map((item) => item.model).join('+') || 'none',
    analyzeFrames: (frames, samplingFps) => firstAnswer(providers, (provider) => provider.analyzeFrames(frames, samplingFps)),
    analyzeClip: (request: VisionClipRequest) => firstAnswer(providers, (provider) => provider.analyzeClip(request)),
    identifyAnatomy: (request: AnatomyRequest) => firstAnswer(providers, (provider) => provider.identifyAnatomy(request)),
    identifyPlane: (request: PlaneRequest) => firstAnswer(providers, (provider) => provider.identifyPlane(request)),
    extractObservations: (frames: VisionFrameInput[], samplingFps: number) => firstAnswer(providers, (provider) => provider.extractObservations(frames, samplingFps)),
  }
}
