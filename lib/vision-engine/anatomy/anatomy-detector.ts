import type { VisionFrameResponse } from '@/lib/vision-engine/types'

export const ANATOMY_ORGANS = [
  'thyroid',
  'carotid',
  'jugular',
  'lung',
  'pleura',
  'heart',
  'ivc',
  'bladder',
  'kidney',
  'liver',
  'gallbladder',
  'aorta',
] as const

export type AnatomyOrgan = (typeof ANATOMY_ORGANS)[number]

export interface AnatomyObservation {
  organ: AnatomyOrgan
  region: string | null
  laterality: 'left' | 'right' | 'midline' | 'unknown'
  confidence: number
  frameIds: string[]
  uncertaintyReason: string | null
}

export function readAnatomy(response: VisionFrameResponse): AnatomyObservation | null {
  for (const row of response.observations) {
    const organ = ANATOMY_ORGANS.find((item) => row.label === item || row.label.startsWith(`${item}_`))
    if (!organ) continue
    const laterality = row.label.includes('left') ? 'left' : row.label.includes('right') ? 'right' : row.label.includes('midline') ? 'midline' : 'unknown'
    const region = row.label.startsWith(`${organ}_`) ? row.label.slice(organ.length + 1) : null
    return {
      organ,
      region,
      laterality,
      confidence: row.confidence,
      frameIds: row.frameIds,
      uncertaintyReason: row.uncertaintyReason,
    }
  }
  return null
}
