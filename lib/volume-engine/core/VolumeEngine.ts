import type { Mat4 } from '@/lib/spatial-reconstruction/types'
import { relativePose, validateMat4 } from '@/lib/volume-engine/core/TransformValidation'
import { DEFAULT_FREEHAND_CONFIG, type Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import type { VolumeErrorCode } from '@/lib/volume-engine/errors'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { FramePlane, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { inspectPose, type PoseQcFinding } from '@/lib/volume-engine/qc/PoseQC'
import { inspectCoverage } from '@/lib/volume-engine/qc/CoverageQC'
import { reconstructSlices } from '@/lib/volume-engine/reconstruction/VolumeReconstructor'
import { advanceTrajectory, originTrajectory, trajectoryFromAbsolute, type TrajectoryPoint } from '@/lib/volume-engine/trajectory/Trajectory'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'
import { emptyVolume, physicalMeasuresAllowed, type ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { PoseMode } from '@/lib/volume-engine/types/VolumeStatus'
import type { VolumeSource } from '@/lib/volume-engine/types/VolumeSource'
import { buildTelemetry, type ReconstructionTelemetry } from '@/lib/volume-engine/telemetry/telemetry'

export interface FreehandFrame {
  frameId: string
  timestamp: number
  image: Float32Array
  width: number
  height: number
  pixelSpacingX: number | null
  pixelSpacingY: number | null
  quality?: number
  fieldMask?: Uint8Array
  transform?: Mat4
  confidence?: number
  uncertaintyMm?: number | null
}

export interface VolumeBuildResult {
  volume: ReconstructedVolume
  trajectory: TrajectoryPoint[]
  acceptedFrames: number
  rejectedFrames: number
  findings: PoseQcFinding[]
  telemetry: ReconstructionTelemetry
  error: VolumeErrorCode | null
  measuresAllowed: boolean
}

function poseModeOf(provider: PoseProvider): PoseMode {
  if (provider.mode === 'reference') return 'reference_test'
  if (provider.mode === 'sensor') return 'sensor'
  if (provider.mode === 'registration') return 'registration'
  return 'learned'
}

function planeOf(frame: FreehandFrame): FramePlane {
  return {
    gray: frame.image,
    width: frame.width,
    height: frame.height,
    pixelSpacingX: frame.pixelSpacingX,
    pixelSpacingY: frame.pixelSpacingY,
  }
}

function sliceOf(frame: FreehandFrame, transform: Mat4, confidence: number): VolumeSliceSample {
  return {
    frameId: frame.frameId,
    timestamp: frame.timestamp,
    image: frame.image,
    width: frame.width,
    height: frame.height,
    transform,
    confidence,
    pixelSpacingX: frame.pixelSpacingX,
    pixelSpacingY: frame.pixelSpacingY,
    quality: frame.quality ?? 1,
    fieldMask: frame.fieldMask,
    source: 'ultrasound',
  }
}

function failed(
  source: VolumeSource,
  poseMode: PoseMode,
  error: VolumeErrorCode,
  findings: PoseQcFinding[],
  provider: PoseProvider,
  frames: number,
  rejected: number,
): VolumeBuildResult {
  const volume = emptyVolume(source, 'unavailable', poseMode)
  return {
    volume,
    trajectory: [],
    acceptedFrames: 0,
    rejectedFrames: rejected,
    findings,
    telemetry: buildTelemetry({
      provider,
      frames,
      accepted: 0,
      rejected,
      volume,
      trajectoryLengthMm: 0,
      reconstructionMs: 0,
    }),
    error,
    measuresAllowed: false,
  }
}

function relativeStep(previous: Mat4, current: Mat4): { translationMm: [number, number, number]; rotationRad: [number, number, number]; confidence: number } {
  const relative = relativePose(previous, current)
  return { ...relative, confidence: 1 }
}

export async function reconstructFreehand(
  frames: readonly FreehandFrame[],
  provider: PoseProvider,
  config: Freehand3DConfig = DEFAULT_FREEHAND_CONFIG,
  source: VolumeSource = 'ultrasound',
): Promise<VolumeBuildResult> {
  const started = Date.now()
  const poseMode = poseModeOf(provider)
  if (!config.enabled) return failed(source, poseMode, 'POSE_MODEL_UNAVAILABLE', [], provider, frames.length, 0)
  if (frames.length === 0) return failed(source, poseMode, 'INSUFFICIENT_COVERAGE', [], provider, 0, 0)
  const findings: PoseQcFinding[] = []
  const accepted: VolumeSliceSample[] = []
  let trajectory: TrajectoryPoint[] = []
  let rejected = 0
  const limits = {
    maxStepMm: config.maxStepMm,
    maxRotationRad: config.maxRotationRad,
    minConfidence: config.minPoseConfidence,
    maxUncertaintyMm: 25,
  }
  const posed = frames.every((frame) => frame.transform)
  const poseStarted = Date.now()
  const lowQuality = (frame: FreehandFrame) => (frame.quality ?? 1) < config.minImageQuality
  try {
    if (posed) {
      const kept: { matrix: Mat4; confidence: number; uncertaintyMm: number | null }[] = []
      for (const frame of frames) {
        if (!frame.transform) continue
        if (lowQuality(frame)) {
          findings.push({ code: 'IMAGE_QUALITY_LOW', message: 'Кадр не принят: низкое качество изображения.' })
          rejected += 1
          continue
        }
        try {
          validateMat4(frame.transform)
        } catch (error) {
          if (!(error instanceof VolumeEngineError)) throw error
          findings.push({ code: error.code, message: error.message })
          rejected += 1
          continue
        }
        const confidence = frame.confidence ?? 1
        const previous = kept[kept.length - 1]
        if (previous && provider.mode !== 'reference') {
          const step = relativeStep(previous.matrix, frame.transform)
          const poseFindings = inspectPose({ ...step, confidence }, limits)
          if (poseFindings.length > 0) {
            findings.push(...poseFindings)
            rejected += 1
            continue
          }
        }
        kept.push({
          matrix: frame.transform,
          confidence,
          uncertaintyMm: frame.uncertaintyMm ?? null,
        })
        accepted.push(sliceOf(frame, frame.transform, confidence))
      }
      trajectory = trajectoryFromAbsolute(kept)
    } else {
      const first = frames[0]
      if (!first) return failed(source, poseMode, 'INSUFFICIENT_COVERAGE', findings, provider, frames.length, 0)
      if (lowQuality(first)) {
        return failed(source, poseMode, 'IMAGE_QUALITY_LOW', [...findings, { code: 'IMAGE_QUALITY_LOW', message: 'Первый кадр слишком низкого качества.' }], provider, frames.length, frames.length)
      }
      let last = first
      let lastPoint = originTrajectory()
      accepted.push(sliceOf(first, lastPoint.matrix, 1))
      trajectory.push(lastPoint)
      for (const frame of frames.slice(1)) {
        if (lowQuality(frame)) {
          findings.push({ code: 'IMAGE_QUALITY_LOW', message: 'Кадр не принят: низкое качество изображения.' })
          rejected += 1
          continue
        }
        const estimate = await provider.estimate(planeOf(last), planeOf(frame))
        const poseFindings = inspectPose(estimate, limits)
        if (poseFindings.length > 0) {
          findings.push(...poseFindings)
          rejected += 1
          continue
        }
        lastPoint = advanceTrajectory(lastPoint, estimate, null)
        last = frame
        trajectory.push(lastPoint)
        accepted.push(sliceOf(frame, lastPoint.matrix, estimate.confidence))
      }
    }
  } catch (error) {
    if (error instanceof VolumeEngineError) {
      return failed(source, poseMode, error.code, [...findings, { code: error.code, message: error.message }], provider, frames.length, frames.length)
    }
    throw error
  }
  if (accepted.length === 0) return failed(source, poseMode, 'INSUFFICIENT_COVERAGE', findings, provider, frames.length, rejected)
  if (accepted.some((slice) => slice.pixelSpacingX == null || slice.pixelSpacingY == null)) {
    const volume = emptyVolume(source, 'preview_only', 'unknown')
    return {
      volume,
      trajectory,
      acceptedFrames: 0,
      rejectedFrames: frames.length,
      findings: [...findings, { code: 'CALIBRATION_MISSING', message: 'Нет шкалы кадра, объём в миллиметрах не строится.' }],
      telemetry: buildTelemetry({ provider, frames: frames.length, accepted: 0, rejected: frames.length, volume, trajectoryLengthMm: 0, reconstructionMs: Date.now() - started }),
      error: 'CALIBRATION_MISSING',
      measuresAllowed: false,
    }
  }
  const poseMs = Date.now() - poseStarted
  let volume: ReconstructedVolume
  let samplingMs = 0
  let allocationMs = 0
  let splattingMs = 0
  try {
    const built = reconstructSlices(accepted, config, poseMode, source)
    volume = built.volume
    samplingMs = built.samplingMs
    allocationMs = built.allocationMs
    splattingMs = built.splattingMs
  } catch (error) {
    if (error instanceof VolumeEngineError) {
      return failed(source, poseMode, error.code, [...findings, { code: error.code, message: error.message }], provider, frames.length, rejected)
    }
    throw error
  }
  const coverageFinding = inspectCoverage(volume, 0)
  if (coverageFinding && volume.observed.length === 0) findings.push(coverageFinding)
  const trajectoryLengthMm = trajectory[trajectory.length - 1]?.cumulativeDistanceMm ?? 0
  return {
    volume,
    trajectory,
    acceptedFrames: accepted.length,
    rejectedFrames: rejected,
    findings,
    telemetry: buildTelemetry({
      provider,
      frames: frames.length,
      accepted: accepted.length,
      rejected,
      volume,
      trajectoryLengthMm,
      reconstructionMs: Date.now() - started,
      samplingMs,
      poseMs,
      splattingMs,
      allocationMs,
    }),
    error: volume.status === 'unavailable' ? 'INSUFFICIENT_COVERAGE' : null,
    measuresAllowed: physicalMeasuresAllowed(volume),
  }
}
