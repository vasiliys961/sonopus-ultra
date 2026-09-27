export type VolumeStatus =
  | 'validated_reference'
  | 'experimental_estimated'
  | 'preview_only'
  | 'unavailable'

export type PoseMode =
  | 'reference_test'
  | 'sensor'
  | 'registration'
  | 'learned'
  | 'unknown'
