import { parallelStack, probeTravel, type StackedSlice } from '@/lib/intelligence/parallel-stack'
import { sampleCine, type CineFrame, type CineSampleOptions } from '@/lib/intelligence/sample-cine'
import { reconstructFreehand, type FreehandFrame } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

/** Шаг сетки совпадает с пикселем уменьшенного кадра. Это единица эскиза, не миллиметр пациента. */
const PREVIEW_STEP = 1

export interface StackSliceRef {
  id: string
  timestamp: number
  depth: number
  similarity: number
  confidence: number
  quality: number
  width: number
  height: number
  gray: Float32Array
  probeX: number
  probeY: number
}

export interface SpatialPreview {
  volume: ReconstructedVolume
  kept: number
  stacked: number
  accepted: number
  depth: number
  coverage: number
  pose: 'VIDEO_ESTIMATION'
  measuresAllowed: false
  note: string
  error: string | null
  slices: StackSliceRef[]
}

export async function buildSpatialPreview(frames: readonly CineFrame[], sample: CineSampleOptions = {}): Promise<SpatialPreview> {
  const kept = sampleCine(frames, sample)
  const stack = parallelStack(kept)
  const engineFrames: FreehandFrame[] = stack.map(toEngineFrame)
  const built = await reconstructFreehand(engineFrames, new RegistrationPoseProvider(), {
    ...DEFAULT_FREEHAND_CONFIG,
    minPoseConfidence: 0.2,
    voxelSizeMm: PREVIEW_STEP,
    maxVoxels: 96 * 96 * 96,
    maxMemoryMB: 64,
    maxStepMm: 8,
    pixelStride: 1,
    minImageQuality: 0.05,
    kernelRadius: 1,
    kernelSigmaMm: 1,
    enableInterpolation: false,
    enableConfidenceVolume: true,
    enableCoverageMap: true,
  })
  const depth = stack[stack.length - 1]?.depth ?? 0
  return {
    volume: built.volume,
    kept: kept.length,
    stacked: stack.length,
    accepted: built.acceptedFrames,
    depth,
    coverage: coverageRatio(built.volume.observed),
    pose: 'VIDEO_ESTIMATION',
    measuresAllowed: false,
    note: previewNote(frames.length, stack, built.acceptedFrames, built.error),
    error: built.error,
    slices: stack.map((slice) => ({
      id: slice.id,
      timestamp: slice.timestamp,
      depth: slice.depth,
      similarity: slice.similarity,
      confidence: slice.confidence,
      quality: slice.quality,
      width: slice.width,
      height: slice.height,
      gray: slice.gray,
      probeX: slice.probe.x,
      probeY: slice.probe.y,
    })),
  }
}

function toEngineFrame(slice: StackedSlice): FreehandFrame {
  return {
    frameId: slice.id,
    timestamp: slice.timestamp,
    image: slice.gray,
    width: slice.width,
    height: slice.height,
    pixelSpacingX: PREVIEW_STEP,
    pixelSpacingY: PREVIEW_STEP,
    quality: Math.max(slice.quality, 0.5),
    fieldMask: slice.mask,
    transform: slice.transform,
    confidence: slice.confidence,
    uncertaintyMm: 8,
  }
}

function previewNote(inputCount: number, stack: readonly StackedSlice[], accepted: number, error: string | null): string {
  if (stack.length === 0) return 'В петле нет кадров для картины.'
  if (error && accepted === 0) return 'Объём не собрался. Петля остаётся кинолентой.'
  if (stack.length < 3) {
    return inputCount >= 3
      ? 'Кадры почти не отличаются. Картина плоская: глубина появляется, когда по ходу прохода картинка меняется.'
      : 'Кадров мало: картина почти плоская. Нужен более длинный проход.'
  }
  const moved = stack.filter((slice) => slice.similarity < 0.93).length
  const travel = probeTravel(stack.map((slice) => ({ probeX: slice.probe.x, probeY: slice.probe.y, depth: slice.depth })))
  if (moved < 2 && travel.depth < 1 && travel.lateral < 1) {
    return 'Картинка почти не менялась. Объём тонкий: датчик, скорее всего, оставался на одном срезе.'
  }
  return `Срезы идут по ходу датчика: в плоскости ${travel.lateral.toFixed(1)}, по глубине ${travel.depth.toFixed(1)}. Единицы сетки, не измеренный ход.`
}
