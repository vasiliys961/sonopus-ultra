import type { VisionFrameResponse } from '@/lib/vision-engine/types'

export const PLANE_TYPES = [
  'unknown',
  'longitudinal',
  'transverse',
  'oblique',
  'apical',
  'parasternal_long',
  'parasternal_short',
  'subcostal',
  'suprasternal',
] as const

export type PlaneType = (typeof PLANE_TYPES)[number]

export interface PlaneObservation {
  type: PlaneType
  confidence: number
  evidenceFrameIds: string[]
  uncertaintyReason: string | null
}

export function readPlane(response: VisionFrameResponse): PlaneObservation | null {
  for (const row of response.observations) {
    if (row.type !== 'plane' && !PLANE_TYPES.includes(row.label as PlaneType)) continue
    const type = PLANE_TYPES.find((item) => item === row.label) ?? 'unknown'
    return {
      type,
      confidence: row.confidence,
      evidenceFrameIds: row.frameIds,
      uncertaintyReason: type === 'unknown' ? (row.uncertaintyReason ?? 'plane_unconfirmed') : row.uncertaintyReason,
    }
  }
  return null
}
