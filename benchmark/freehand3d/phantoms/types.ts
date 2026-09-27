import type { Vec3 } from '@/lib/spatial-reconstruction/types'

export interface Bounds3D {
  min: Vec3
  max: Vec3
}

export interface PhantomGroundTruth {
  bounds: Bounds3D
  centroid: Vec3
  volumeMm3: number
  dimensionsMm: Vec3
  diameterMm?: number
  lengthMm?: number
  distanceBetweenStructuresMm?: number
}

export interface Phantom {
  id: 'sphere' | 'cylinder' | 'parallel-cylinders' | 'curved-tube'
  truth: PhantomGroundTruth
  contains(point: Vec3): boolean
}
