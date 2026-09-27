import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface VolumeExportMeta {
  source: ReconstructedVolume['source']
  status: ReconstructedVolume['status']
  poseMode: ReconstructedVolume['poseMode']
  originMm: ReconstructedVolume['originMm']
  spacingMm: ReconstructedVolume['spacingMm']
  size: ReconstructedVolume['size']
  clinicallyValidated: false
  observedVoxels: number
}

export function volumeMeta(volume: ReconstructedVolume): VolumeExportMeta {
  let observedVoxels = 0
  for (const bit of volume.observed) observedVoxels += bit
  return {
    source: volume.source,
    status: volume.status,
    poseMode: volume.poseMode,
    originMm: volume.originMm,
    spacingMm: volume.spacingMm,
    size: volume.size,
    clinicallyValidated: false,
    observedVoxels,
  }
}

export function serializeVolumeMeta(volume: ReconstructedVolume): string {
  return JSON.stringify(volumeMeta(volume))
}
