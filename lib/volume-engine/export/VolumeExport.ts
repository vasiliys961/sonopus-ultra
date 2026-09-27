import { serializeVolumeMeta, volumeMeta, type VolumeExportMeta } from '@/lib/volume-engine/export/VolumeSerializer'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface VolumeExport {
  meta: VolumeExportMeta
  observed: Uint8Array
}

/** Скаляры наружу не отдаются: это кадры, а не телеметрия. */
export function exportVolume(volume: ReconstructedVolume): VolumeExport {
  return {
    meta: volumeMeta(volume),
    observed: volume.observed,
  }
}

export function exportVolumeJson(volume: ReconstructedVolume): string {
  return serializeVolumeMeta(volume)
}
