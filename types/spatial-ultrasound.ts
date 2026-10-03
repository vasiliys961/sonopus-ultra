export type FrameSource = 'VIDEO' | 'DICOM' | 'LIVE_CAPTURE' | 'PROBE_STREAM'

export type PoseSource = 'TRACKER' | 'VIDEO_ESTIMATION' | 'IMAGE_REGISTRATION' | 'MANUAL' | 'UNKNOWN'

export interface FrameQuality {
  overall: number
  sharpness: number
  contrast: number
  brightness: number
  artifactLevel: number
  usable: boolean
}

export interface ProbePose {
  position: [number, number, number]
  rotation: { x: number; y: number; z: number }
  quaternion?: [number, number, number, number]
  confidence: number
  source: PoseSource
}

/** Кадр петли. Пиксели живут в сером массиве 0..1, не в DOM-картинке. */
export interface USFrame {
  id: string
  timestamp: number
  width: number
  height: number
  gray?: Float32Array
  source: FrameSource
  quality: FrameQuality
  pose?: ProbePose
}
