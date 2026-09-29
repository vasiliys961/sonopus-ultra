import { relativePose } from '@/lib/volume-engine/core/TransformValidation'
import { advanceTrajectory, originTrajectory } from '@/lib/volume-engine/trajectory/Trajectory'
import { dofToMatrix, translationOf } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { VolumeEngineError } from '@/lib/volume-engine/errors'
import type { AxisKnowledge, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { inspectPose } from '@/lib/volume-engine/qc/PoseQC'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'
import type { SweepFrame } from '@/benchmark/freehand3d/phantoms/sweep'

export interface PoseStep {
  frameIndex: number
  matrix: Mat4
  estimate: PoseEstimate | null
}

const KNOWN: [AxisKnowledge, AxisKnowledge, AxisKnowledge] = ['known', 'known', 'known']

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index] ?? 0
}

function maxOf(values: readonly number[]): number {
  let best = 0
  for (const value of values) if (value > best) best = value
  return best
}

function knownDistance(delta: Vec3, axes: readonly AxisKnowledge[]): MetricValue {
  const parts: number[] = []
  for (let axis = 0; axis < 3; axis += 1) {
    if (axes[axis] !== 'known') continue
    parts.push(delta[axis])
  }
  if (parts.length === 0) return 'NOT ESTIMATED'
  return Math.hypot(...parts)
}

function summarize(values: number[]): { meanMm: MetricValue; p95Mm: MetricValue; maxMm: MetricValue } {
  if (values.length === 0) return { meanMm: 'NOT AVAILABLE', p95Mm: 'NOT AVAILABLE', maxMm: 'NOT AVAILABLE' }
  return { meanMm: mean(values), p95Mm: percentile(values, 0.95), maxMm: maxOf(values) }
}

export interface PoseTrajectoryReport {
  local: {
    meanTranslationMm: MetricValue
    p95TranslationMm: MetricValue
    translationXMm: MetricValue
    translationYMm: MetricValue
    translationZMm: MetricValue
    rotationDeg: MetricValue
    knownTransitions: number
    unknownTransitions: number
    rejectedTransitions: number
  }
  global: {
    meanTranslationMm: MetricValue
    p95TranslationMm: MetricValue
    maxTranslationMm: MetricValue
    translationZMm: MetricValue
    rotationDeg: MetricValue
    p95RotationDeg: MetricValue
    maxRotationDeg: MetricValue
  }
  drift: {
    knownAxesTranslationMm: MetricValue
    placementTranslationMm: MetricValue
    rotationDeg: MetricValue
  }
}

function knownEuler(rotation: Vec3, axes: readonly AxisKnowledge[]): Vec3 {
  return [
    axes[0] === 'known' ? rotation[0] : 0,
    axes[1] === 'known' ? rotation[1] : 0,
    axes[2] === 'known' ? rotation[2] : 0,
  ]
}

/** Угол между двумя ориентациями. Неизвестные оси не входят в сравнение. */
function rotationErrorDeg(truth: Vec3, pose: Vec3, axes: readonly AxisKnowledge[]): number {
  const delta = relativePose(dofToMatrix([0, 0, 0], knownEuler(truth, axes)), dofToMatrix([0, 0, 0], knownEuler(pose, axes)))
  const matrix = dofToMatrix([0, 0, 0], delta.rotationRad)
  const trace = matrix[0] + matrix[5] + matrix[10]
  const cosine = Math.min(1, Math.max(-1, (trace - 1) / 2))
  return Math.acos(cosine) * (180 / Math.PI)
}

function axisError(values: number[], known: boolean): MetricValue {
  if (!known || values.length === 0) return 'NOT ESTIMATED'
  return mean(values)
}

export function poseTrajectoryMetrics(
  groundTruth: readonly Mat4[],
  provided: readonly Mat4[],
  translationAxes: readonly AxisKnowledge[],
  rotationAxes: readonly AxisKnowledge[],
  rejectedTransitions = 0,
): PoseTrajectoryReport {
  const localKnown: number[] = []
  const localX: number[] = []
  const localY: number[] = []
  const localZ: number[] = []
  const localRotation: number[] = []
  let xKnown = false
  let yKnown = false
  let zKnown = false
  let rotationKnown = false
  let unknownTransitions = 0
  const count = Math.min(groundTruth.length, provided.length)
  for (let index = 1; index < count; index += 1) {
    const previousTruth = groundTruth[index - 1]
    const currentTruth = groundTruth[index]
    const previousPose = provided[index - 1]
    const currentPose = provided[index]
    if (!previousTruth || !currentTruth || !previousPose || !currentPose) continue
    if (translationAxes.every((axis) => axis === 'unknown') && rotationAxes.every((axis) => axis === 'unknown')) {
      unknownTransitions += 1
      continue
    }
    const truthStep = relativePose(previousTruth, currentTruth)
    const providedStep = relativePose(previousPose, currentPose)
    const parts: number[] = []
    if (translationAxes[0] === 'known') {
      xKnown = true
      const error = Math.abs(providedStep.translationMm[0] - truthStep.translationMm[0])
      localX.push(error)
      parts.push(error)
    }
    if (translationAxes[1] === 'known') {
      yKnown = true
      const error = Math.abs(providedStep.translationMm[1] - truthStep.translationMm[1])
      localY.push(error)
      parts.push(error)
    }
    if (translationAxes[2] === 'known') {
      zKnown = true
      const error = Math.abs(providedStep.translationMm[2] - truthStep.translationMm[2])
      localZ.push(error)
      parts.push(error)
    }
    if (parts.length > 0) localKnown.push(Math.hypot(...parts))
    if (rotationAxes.some((axis) => axis === 'known')) {
      rotationKnown = true
      localRotation.push(rotationErrorDeg(truthStep.rotationRad, providedStep.rotationRad, rotationAxes))
    }
  }
  const globalKnown: number[] = []
  const globalPlacement: number[] = []
  const globalZ: number[] = []
  const globalRotation: number[] = []
  const originTruthMatrix = groundTruth[0]
  const originPoseMatrix = provided[0]
  const originTruth = originTruthMatrix ? translationOf(originTruthMatrix) : null
  const originPose = originPoseMatrix ? translationOf(originPoseMatrix) : null
  const rotationKnownGlobally = rotationAxes.some((axis) => axis === 'known')
  if (originTruth && originPose && originTruthMatrix && originPoseMatrix) {
    for (let index = 1; index < count; index += 1) {
      const truth = groundTruth[index]
      const pose = provided[index]
      if (!truth || !pose) continue
      const truthDelta = translationOf(truth).map((value, axis) => value - originTruth[axis]) as Vec3
      const poseDelta = translationOf(pose).map((value, axis) => value - originPose[axis]) as Vec3
      const full: Vec3 = [poseDelta[0] - truthDelta[0], poseDelta[1] - truthDelta[1], poseDelta[2] - truthDelta[2]]
      globalPlacement.push(Math.hypot(full[0], full[1], full[2]))
      if (translationAxes[2] === 'known') globalZ.push(Math.abs(full[2]))
      const known = knownDistance(full, translationAxes)
      if (typeof known === 'number') globalKnown.push(known)
      if (rotationKnownGlobally) {
        const truthTurn = relativePose(originTruthMatrix, truth).rotationRad
        const poseTurn = relativePose(originPoseMatrix, pose).rotationRad
        globalRotation.push(rotationErrorDeg(truthTurn, poseTurn, rotationAxes))
      }
    }
  }
  const globalSummary = summarize(globalKnown)
  const rotationSummary = summarize(globalRotation)
  const localRotationValue = rotationKnown && localRotation.length > 0 ? mean(localRotation) : rotationAxes.some((axis) => axis === 'known') ? 'NOT AVAILABLE' : 'NOT ESTIMATED'
  const globalRotationValue = rotationKnownGlobally ? rotationSummary.meanMm : 'NOT ESTIMATED'
  return {
    local: {
      meanTranslationMm: localKnown.length > 0 ? mean(localKnown) : translationAxes.some((axis) => axis === 'known') ? 'NOT AVAILABLE' : 'NOT ESTIMATED',
      p95TranslationMm: localKnown.length > 0 ? percentile(localKnown, 0.95) : 'NOT ESTIMATED',
      translationXMm: axisError(localX, xKnown),
      translationYMm: axisError(localY, yKnown),
      translationZMm: axisError(localZ, zKnown),
      rotationDeg: localRotationValue,
      knownTransitions: localKnown.length,
      unknownTransitions,
      rejectedTransitions,
    },
    global: {
      meanTranslationMm: globalSummary.meanMm,
      p95TranslationMm: globalSummary.p95Mm,
      maxTranslationMm: globalSummary.maxMm,
      translationZMm: translationAxes[2] === 'known' ? (globalZ.length > 0 ? mean(globalZ) : 'NOT AVAILABLE') : 'NOT ESTIMATED',
      rotationDeg: globalRotationValue,
      p95RotationDeg: rotationKnownGlobally ? rotationSummary.p95Mm : 'NOT ESTIMATED',
      maxRotationDeg: rotationKnownGlobally ? rotationSummary.maxMm : 'NOT ESTIMATED',
    },
    drift: {
      knownAxesTranslationMm: globalKnown.length > 0 ? globalKnown[globalKnown.length - 1] ?? 'NOT AVAILABLE' : globalSummary.meanMm,
      placementTranslationMm: globalPlacement.length > 0 ? globalPlacement[globalPlacement.length - 1] ?? 'NOT AVAILABLE' : 'NOT AVAILABLE',
      rotationDeg: rotationKnownGlobally ? (globalRotation.length > 0 ? globalRotation[globalRotation.length - 1] ?? 'NOT AVAILABLE' : 'NOT AVAILABLE') : 'NOT ESTIMATED',
    },
  }
}

export function perfectPoseTrajectory(frames: readonly SweepFrame[]): PoseTrajectoryReport {
  return poseTrajectoryMetrics(
    frames.map((frame) => frame.groundTruthTransform),
    frames.map((frame) => frame.transform ?? frame.groundTruthTransform),
    KNOWN,
    KNOWN,
  )
}

function planeOf(frame: SweepFrame) {
  return {
    gray: frame.image,
    width: frame.width,
    height: frame.height,
    pixelSpacingX: frame.pixelSpacingX,
    pixelSpacingY: frame.pixelSpacingY,
  }
}

/** Повторяет цепочку принятия кадров Volume Engine. Оценки попадают в объём только если кадр принят. */
export async function collectRegistrationPoses(
  frames: readonly SweepFrame[],
  provider: PoseProvider,
  config: Freehand3DConfig = DEFAULT_FREEHAND_CONFIG,
): Promise<{ accepted: PoseStep[]; rejected: number; error: string | null }> {
  if (frames.length === 0) return { accepted: [], rejected: 0, error: 'INSUFFICIENT_COVERAGE' }
  const limits = {
    maxStepMm: config.maxStepMm,
    maxRotationRad: config.maxRotationRad,
    minConfidence: config.minPoseConfidence,
    maxUncertaintyMm: 25,
  }
  const first = frames[0]
  if (!first || (first.quality ?? 1) < config.minImageQuality) {
    return { accepted: [], rejected: frames.length, error: 'IMAGE_QUALITY_LOW' }
  }
  const accepted: PoseStep[] = [{ frameIndex: 0, matrix: originTrajectory().matrix, estimate: null }]
  let last = first
  let lastPoint = originTrajectory()
  let rejected = 0
  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index]
    if (!frame) continue
    if ((frame.quality ?? 1) < config.minImageQuality) {
      rejected += 1
      continue
    }
    let estimate: PoseEstimate
    try {
      estimate = await provider.estimate(planeOf(last), planeOf(frame))
    } catch (error) {
      if (error instanceof VolumeEngineError) return { accepted: [], rejected: frames.length, error: error.code }
      throw error
    }
    if (inspectPose(estimate, limits).length > 0) {
      rejected += 1
      continue
    }
    lastPoint = advanceTrajectory(lastPoint, estimate, null)
    last = frame
    accepted.push({ frameIndex: index, matrix: lastPoint.matrix, estimate })
  }
  return { accepted, rejected, error: null }
}

export function registrationTrajectory(frames: readonly SweepFrame[], accepted: readonly PoseStep[]): PoseTrajectoryReport {
  const axes = accepted.find((step) => step.estimate)?.estimate
  const translationAxes = axes?.translationAxes ?? ['unknown', 'unknown', 'unknown']
  const rotationAxes = axes?.rotationAxes ?? ['unknown', 'unknown', 'unknown']
  if (accepted.length < 2) {
    const empty = poseTrajectoryMetrics([], [], translationAxes, rotationAxes, Math.max(0, frames.length - accepted.length))
    empty.local.rejectedTransitions = Math.max(0, frames.length - 1)
    return empty
  }
  return poseTrajectoryMetrics(
    accepted.map((step) => {
      const frame = frames[step.frameIndex]
      if (!frame) throw new Error('принятый кадр отсутствует в последовательности')
      return frame.groundTruthTransform
    }),
    accepted.map((step) => step.matrix),
    translationAxes,
    rotationAxes,
    Math.max(0, frames.length - accepted.length),
  )
}
