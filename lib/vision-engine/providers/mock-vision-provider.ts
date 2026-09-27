import type { VisionFrameInput, VisionFrameResponse } from '@/lib/vision-engine/types'
import type { AnatomyRequest, PlaneRequest, VisionClipRequest, VisionProvider } from '@/lib/vision-engine/providers/vision-provider'

function mockResponse(frames: VisionFrameInput[]): VisionFrameResponse {
  const frame = frames[0]
  if (!frame) {
    return { schemaVersion: 'vision-1.0', observations: [], uncertainties: ['нет кадра'] }
  }
  return {
    schemaVersion: 'vision-1.0',
    observations: [
      {
        id: `mock-${frame.id}`,
        type: 'perception',
        label: 'demo_field',
        confidence: 0.5,
        frameIds: [frame.id],
        timestamp: frame.timestamp,
        uncertaintyReason: 'mock_provider',
      },
    ],
    uncertainties: ['mock_provider'],
  }
}

export function createMockVisionProvider(): VisionProvider {
  return {
    id: 'mock',
    model: 'mock',
    analyzeFrames(frames) {
      return Promise.resolve(mockResponse(frames))
    },
    analyzeClip(request: VisionClipRequest) {
      return Promise.resolve(mockResponse(request.frames))
    },
    identifyAnatomy(request: AnatomyRequest) {
      return Promise.resolve(mockResponse(request.frames))
    },
    identifyPlane(request: PlaneRequest) {
      return Promise.resolve(mockResponse(request.frames))
    },
    extractObservations(frames) {
      return Promise.resolve(mockResponse(frames))
    },
  }
}
