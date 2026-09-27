export interface VisionEngineConfig {
  fastLoopFps: number
  visionLoopFps: number
  minQualityScore: number
  minStableMs: number
  maxVisionCallsPerMinute: number
  enableTracking: boolean
  enableProtocol: boolean
  enableMeasurements: boolean
  enable3DExperimental: boolean
  enableCloudVision: boolean
  debug: boolean
}

export const DEFAULT_VISION_CONFIG: VisionEngineConfig = {
  fastLoopFps: 15,
  visionLoopFps: 2,
  minQualityScore: 0.75,
  minStableMs: 1000,
  maxVisionCallsPerMinute: 30,
  enableTracking: true,
  enableProtocol: true,
  enableMeasurements: true,
  enable3DExperimental: false,
  enableCloudVision: false,
  debug: false,
}

export function visionConfig(overrides: Partial<VisionEngineConfig> = {}): VisionEngineConfig {
  return { ...DEFAULT_VISION_CONFIG, ...overrides }
}
