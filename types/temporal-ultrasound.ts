export type KeyFrameKind = 'ANATOMICAL' | 'PATHOLOGY_SUSPECT' | 'MOTION' | 'BOUNDARY' | 'BEST_QUALITY'

export interface KeyFrame {
  frameId: string
  timestamp: number
  kind: KeyFrameKind
}

export interface TemporalSequence {
  frameIds: string[]
  from: number
  to: number
}

export interface TemporalSummary {
  meanChange: number
  peakChange: number
  changedSteps: number
  stable: boolean
}

export interface InPlaneShift {
  meanDx: number
  meanDy: number
  source: 'VIDEO_ESTIMATION'
}
