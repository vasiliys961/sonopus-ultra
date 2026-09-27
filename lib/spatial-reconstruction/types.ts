export type Vec3 = [number, number, number]

/** Строка за строкой. Точка — столбец: p' = M · p. */
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export interface PoseEstimate {
  fromFrame: number
  toFrame: number
  translationMm: Vec3
  rotationRad: Vec3
  /** null — сеть не сообщила уверенность. Единица здесь не подставляется. */
  confidence: number | null
  source: 'pose-network'
}

export interface TrajectoryPoint {
  frameIndex: number
  transform: Mat4
  translationMm: Vec3
  confidence: number | null
}

export interface VolumeEstimate {
  spacingMm: number
  originMm: Vec3
  size: [number, number, number]
  intensity: Float32Array
  counts: Uint16Array
  occupied: number
  clinicallyValidated: false
  domain: 'geometry-only'
}

export type Sector = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'

export interface CoverageMap {
  covered: Sector[]
  missing: Sector[]
  hints: string[]
}

export const TUS_REC_LIMITATION =
  'Веса baseline TUS-REC не приложены. Датасет челленджа — предплечье, не мочевой пузырь, полая вена или сердце. Ошибку на клинических целях этот модуль не публикует.'
