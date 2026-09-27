import type { PoseQcFinding } from '@/lib/volume-engine/qc/PoseQC'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export function inspectCoverage(volume: ReconstructedVolume, minCoverage: number): PoseQcFinding | null {
  if (volume.observed.length === 0) return { code: 'INSUFFICIENT_COVERAGE', message: 'В объёме нет наблюдений.' }
  if (coverageRatio(volume.observed) < minCoverage) {
    return { code: 'INSUFFICIENT_COVERAGE', message: 'Покрытие объёма ниже заданного порога.' }
  }
  return null
}
