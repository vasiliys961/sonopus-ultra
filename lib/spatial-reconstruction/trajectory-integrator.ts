import { assertFinite } from '@/lib/domain/number'
import { dofToMatrix, IDENTITY, multiplyMat4, translationOf } from '@/lib/spatial-reconstruction/rigid'
import type { PoseEstimate, TrajectoryPoint, Vec3 } from '@/lib/spatial-reconstruction/types'

export interface RelativeStep {
  translationMm: Vec3
  rotationRad: Vec3
  confidence: number | null
}

function readConfidence(value: number | null): number | null {
  if (value === null) return null
  assertFinite(value, 'уверенность позы')
  if (value < 0 || value > 1) throw new Error('уверенность позы: ожидается число от 0 до 1')
  return value
}

export function integrateTrajectory(steps: readonly RelativeStep[]): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [
    { frameIndex: 0, transform: IDENTITY, translationMm: [0, 0, 0], confidence: 1 },
  ]
  for (const step of steps) {
    step.translationMm.forEach((value, index) => assertFinite(value, `перенос ${index}`))
    step.rotationRad.forEach((value, index) => assertFinite(value, `поворот ${index}`))
    const confidence = readConfidence(step.confidence)
    const previous = points[points.length - 1]
    const local = dofToMatrix(step.translationMm, step.rotationRad)
    const transform = multiplyMat4(previous.transform, local)
    const accumulated = previous.confidence === null || confidence === null ? null : previous.confidence * confidence
    points.push({
      frameIndex: previous.frameIndex + 1,
      transform,
      translationMm: translationOf(transform),
      confidence: accumulated,
    })
  }
  return points
}

export function stepsFromEstimates(estimates: readonly PoseEstimate[]): RelativeStep[] {
  return estimates.map((estimate, index) => {
    if (estimate.toFrame !== index || estimate.fromFrame !== index + 1) {
      throw new Error('оценки позы должны идти соседними кадрами от нулевого кадра')
    }
    return {
      translationMm: estimate.translationMm,
      rotationRad: estimate.rotationRad,
      confidence: estimate.confidence,
    }
  })
}
