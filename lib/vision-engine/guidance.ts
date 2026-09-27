import type { EvidencePack } from '@/lib/vision-engine/evidence/evidence-pack'
import type { TemporalState } from '@/lib/vision-engine/tracking/temporal-tracker'

export type VisionGuidanceCode =
  | 'idle'
  | 'hold_steady'
  | 'high_motion'
  | 'plane_unconfirmed'
  | 'plane_found'
  | 'turn_for_view'
  | 'quality_ok'

export interface VisionPanel {
  quality: number | null
  anatomy: string | null
  plane: string | null
  confidence: number | null
  tracking: TemporalState['state'] | 'off'
  protocolDone: number
  protocolTotal: number
  guidance: VisionGuidanceCode
  missingView: string | null
  frames: number
  clips: number
  observations: number
  candidates: number
  uncertainty: string | null
}

export function visionGuidance(input: {
  quality: number | null
  motion: number
  tracking: VisionPanel['tracking']
  anatomy: string | null
  plane: string | null
  missingView: string | null
}): VisionGuidanceCode {
  if (input.motion > 0.45) return 'high_motion'
  if (input.quality === null || input.quality < 0.75 || input.tracking === 'unstable' || input.tracking === 'off') return 'hold_steady'
  if (input.anatomy && !input.plane) return 'plane_unconfirmed'
  if (input.plane) return 'plane_found'
  if (input.missingView) return 'turn_for_view'
  return 'quality_ok'
}

export function panelFromPerception(input: {
  quality: number | null
  motion: number
  tracking: VisionPanel['tracking']
  pack: EvidencePack | null
  protocolDone: number
  protocolTotal: number
  missingView: string | null
  cloudNote: string | null
}): VisionPanel {
  const anatomy = input.pack?.anatomy[0]
  const plane = input.pack?.planes.find((item) => item.type !== 'unknown') ?? null
  const confidence = anatomy?.confidence ?? plane?.confidence ?? null
  return {
    quality: input.quality,
    anatomy: anatomy ? anatomy.organ : null,
    plane: plane ? plane.type : null,
    confidence,
    tracking: input.tracking,
    protocolDone: input.protocolDone,
    protocolTotal: input.protocolTotal,
    guidance: visionGuidance({
      quality: input.quality,
      motion: input.motion,
      tracking: input.tracking,
      anatomy: anatomy ? anatomy.organ : null,
      plane: plane ? plane.type : null,
      missingView: input.missingView,
    }),
    missingView: input.missingView,
    frames: input.pack?.selectedFrames.length ?? 0,
    clips: input.pack?.selectedClips.length ?? 0,
    observations: input.pack?.observations.length ?? 0,
    candidates: input.pack?.measurements.filter((item) => item.validationStatus === 'candidate').length ?? 0,
    uncertainty: input.cloudNote ?? input.pack?.uncertainties[0] ?? input.pack?.contradictions[0]?.code ?? null,
  }
}
