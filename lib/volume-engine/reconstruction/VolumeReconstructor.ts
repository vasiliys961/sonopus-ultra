import { assertPositive } from '@/lib/domain/number'
import { boundsOf } from '@/lib/volume-engine/core/VolumeBounds'
import { allocateGrid } from '@/lib/volume-engine/core/VolumeBuilder'
import { sampleSlice } from '@/lib/volume-engine/core/VolumeSampler'
import type { Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import { resolutionOf } from '@/lib/volume-engine/config/Freehand3DConfig'
import { fillBridgedGaps } from '@/lib/volume-engine/reconstruction/GapAnalyzer'
import { splatSample } from '@/lib/volume-engine/reconstruction/WeightedSplatting'
import { emptyVolume, type ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'
import type { PoseMode } from '@/lib/volume-engine/types/VolumeStatus'
import type { VolumeSource } from '@/lib/volume-engine/types/VolumeSource'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

export function reconstructSlices(
  slices: readonly VolumeSliceSample[],
  config: Freehand3DConfig,
  poseMode: PoseMode,
  source: VolumeSource,
): ReconstructedVolume {
  assertPositive(config.voxelSizeMm, 'шаг вокселя')
  if (slices.length === 0) return emptyVolume(source, 'unavailable', poseMode)
  if (slices.some((slice) => slice.pixelSpacingX == null || slice.pixelSpacingY == null)) {
    return emptyVolume(source, 'preview_only', poseMode === 'reference_test' ? 'unknown' : poseMode)
  }
  const samples = slices.flatMap((slice) => sampleSlice(slice))
  const bounds = boundsOf(samples.map((sample) => sample.point))
  if (!bounds) return emptyVolume(source, 'unavailable', poseMode)
  let grid
  try {
    grid = allocateGrid(bounds, config.voxelSizeMm, resolutionOf(config))
  } catch (error) {
    if (error instanceof VolumeEngineError) throw error
    throw error
  }
  for (const sample of samples) splatSample({ ...grid, voxelMm: config.voxelSizeMm }, sample)
  const cells = grid.size[0] * grid.size[1] * grid.size[2]
  const scalars = new Float32Array(cells)
  const observed = new Uint8Array(cells)
  const confidence = new Float32Array(cells)
  const coverage = new Float32Array(cells)
  for (let index = 0; index < cells; index += 1) {
    const weight = grid.weights[index] ?? 0
    if (weight <= 0) continue
    scalars[index] = (grid.sums[index] ?? 0) / weight
    observed[index] = 1
    confidence[index] = config.enableConfidenceVolume ? (grid.confidence[index] ?? 0) / weight : 0
    coverage[index] = config.enableCoverageMap ? Math.min(1, weight) : 0
  }
  const interpolated = new Uint8Array(cells)
  if (config.enableInterpolation) fillBridgedGaps(grid.size, scalars, observed, interpolated)
  const status = poseMode === 'reference_test' ? 'validated_reference' : 'experimental_estimated'
  return {
    originMm: grid.originMm,
    spacingMm: [config.voxelSizeMm, config.voxelSizeMm, config.voxelSizeMm],
    size: grid.size,
    scalars,
    observed,
    interpolated,
    confidence,
    coverage,
    source,
    status,
    poseMode,
    clinicallyValidated: false,
  }
}
