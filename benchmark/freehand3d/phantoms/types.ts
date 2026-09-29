import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface Bounds3D {
  min: Vec3
  max: Vec3
}

export type MeasurementAxis = 0 | 1 | 2 | 'components' | 'arc'

export interface PhantomMeasurement {
  name: 'diameter' | 'length' | 'separation' | 'centerline'
  expectedMm: number
  axis: MeasurementAxis
}

export interface PhantomGroundTruth {
  bounds: Bounds3D
  centroid: Vec3
  /** Аналитический объём. Это не число вокселей. */
  volumeMm3: number
  dimensionsMm: Vec3
  diameterMm?: number
  lengthMm?: number
  distanceBetweenStructuresMm?: number
  measurements: readonly PhantomMeasurement[]
}

export interface Phantom {
  id: 'sphere' | 'cylinder' | 'parallel-cylinders' | 'curved-tube'
  truth: PhantomGroundTruth
  /** Полилиния оси, если она задана отдельно от габарита. */
  centerline?: readonly Vec3[]
  contains(point: Vec3): boolean
}
