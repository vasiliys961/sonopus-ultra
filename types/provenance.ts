export type VoxelOrigin =
  | 'US_DIRECT'
  | 'US_INTERPOLATED'
  | 'MRI_REGISTERED'
  | 'CT_REGISTERED'
  | 'ATLAS_INFERRED'
  | 'UNKNOWN'

export interface ConfidenceParts {
  visual: number
  spatial: number
  temporal: number
  anatomical: number
  model: number
  overall: number
}

export interface FindingProvenance {
  source: 'US_DIRECT' | 'US_RECONSTRUCTED' | 'MRI_REGISTERED' | 'CT_REGISTERED' | 'ATLAS_COMPARISON'
  frames: string[]
  coordinates: { x: number; y: number; z: number }
  confidence: ConfidenceParts
  spatialConsistency: number
  temporalConsistency: number
  model: string
  timestamp: number
}
