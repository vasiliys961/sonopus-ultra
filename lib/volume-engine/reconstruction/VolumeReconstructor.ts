import { boundsOf } from '@/lib/volume-engine/core/VolumeBounds'
import { allocateGrid } from '@/lib/volume-engine/core/VolumeBuilder'
import { sampleSlice } from '@/lib/volume-engine/core/VolumeSampler'
import type { Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import { resolutionOf, voxelSpacing } from '@/lib/volume-engine/config/Freehand3DConfig'
import { fillBridgedGaps } from '@/lib/volume-engine/reconstruction/GapAnalyzer'
import { splatSample } from '@/lib/volume-engine/reconstruction/WeightedSplatting'
import { emptyVolume, type ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'
import type { PoseMode } from '@/lib/volume-engine/types/VolumeStatus'
import type { VolumeSource } from '@/lib/volume-engine/types/VolumeSource'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

export interface SliceReconstruction {
  volume: ReconstructedVolume
  samplingMs: number
  allocationMs: number
  splattingMs: number
}

function pack(volume: ReconstructedVolume, samplingMs = 0, allocationMs = 0, splattingMs = 0): SliceReconstruction {
  return { volume, samplingMs, allocationMs, splattingMs }
}

export function reconstructSlices(
  slices: readonly VolumeSliceSample[],
  config: Freehand3DConfig,
  poseMode: PoseMode,
  source: VolumeSource,
): SliceReconstruction {
  const spacing = voxelSpacing(config)
  if (spacing.some((step) => !Number.isFinite(step) || step <= 0)) {
    throw new VolumeEngineError('INVALID_VOXEL_SIZE', 'Шаг вокселя задаётся в миллиметрах и должен быть больше нуля.')
  }
  if (slices.length === 0) return pack(emptyVolume(source, 'unavailable', poseMode))
  if (slices.some((slice) => slice.pixelSpacingX == null || slice.pixelSpacingY == null)) {
    return pack(emptyVolume(source, 'preview_only', poseMode === 'reference_test' ? 'unknown' : poseMode))
  }
  const sampledAt = Date.now()
  const samples = slices.flatMap((slice) => sampleSlice(slice, {
    pixelStride: config.pixelStride,
    maxSamplesPerFrame: config.maxSamplesPerFrame,
  }))
  const samplingMs = Date.now() - sampledAt
  const bounds = boundsOf(samples.map((sample) => sample.point))
  if (!bounds) return pack(emptyVolume(source, 'unavailable', poseMode), samplingMs)
  const allocatedAt = Date.now()
  const grid = allocateGrid(bounds, spacing, resolutionOf(config))
  const allocationMs = Date.now() - allocatedAt
  const splattedAt = Date.now()
  for (const sample of samples) {
    splatSample({
      ...grid,
      kernelRadius: config.kernelRadius,
      kernelSigmaMm: config.kernelSigmaMm,
    }, sample)
  }
  const splattingMs = Date.now() - splattedAt
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
  return pack({
    originMm: grid.originMm,
    spacingMm: spacing,
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
  }, samplingMs, allocationMs, splattingMs)
}
