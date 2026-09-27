import type { VisionFrameInput, VisionFrameResponse } from '@/lib/vision-engine/types'

export interface VisionClipRequest {
  id: string
  startTime: number
  endTime: number
  samplingFps: number
  frames: VisionFrameInput[]
}

export interface AnatomyRequest {
  frames: VisionFrameInput[]
  samplingFps: number
}

export interface PlaneRequest {
  frames: VisionFrameInput[]
  samplingFps: number
}

export interface VisionProvider {
  readonly id: string
  readonly model: string
  analyzeFrames(frames: VisionFrameInput[], samplingFps: number): Promise<VisionFrameResponse>
  analyzeClip(request: VisionClipRequest): Promise<VisionFrameResponse>
  identifyAnatomy(request: AnatomyRequest): Promise<VisionFrameResponse>
  identifyPlane(request: PlaneRequest): Promise<VisionFrameResponse>
  extractObservations(frames: VisionFrameInput[], samplingFps: number): Promise<VisionFrameResponse>
}
