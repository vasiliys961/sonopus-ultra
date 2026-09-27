import type { PoseQcFinding } from '@/lib/volume-engine/qc/PoseQC'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'

export function inspectVolume(volume: ReconstructedVolume, minCoverage: number): PoseQcFinding[] {
  if (volume.size[0] === 0) return []
  const ratio = coverageRatio(volume.observed)
  if (ratio < minCoverage) {
    return [{ code: 'INSUFFICIENT_COVERAGE', message: 'Покрытие объёма ниже заданного порога.' }]
  }
  return []
}

export function observedCount(volume: ReconstructedVolume): number {
  let count = 0
  for (const bit of volume.observed) count += bit
  return count
}
