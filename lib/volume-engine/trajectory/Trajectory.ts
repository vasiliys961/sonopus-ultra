import { dofToMatrix, IDENTITY, multiplyMat4, translationOf } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { PoseEstimate } from '@/lib/volume-engine/pose/PoseProvider'

export interface TrajectoryPoint {
  frameIndex: number
  matrix: Mat4
  confidence: number
  cumulativeDistanceMm: number
  uncertaintyMm: number | null
}

function lengthOf(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function trajectoryFromAbsolute(
  poses: readonly { matrix: Mat4; confidence: number; uncertaintyMm: number | null }[],
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = []
  for (const pose of poses) {
    const previous = points[points.length - 1]
    const current = translationOf(pose.matrix)
    const step = previous
      ? lengthOf([
        current[0] - translationOf(previous.matrix)[0],
        current[1] - translationOf(previous.matrix)[1],
        current[2] - translationOf(previous.matrix)[2],
      ])
      : 0
    points.push({
      frameIndex: points.length,
      matrix: pose.matrix,
      confidence: pose.confidence,
      cumulativeDistanceMm: (previous?.cumulativeDistanceMm ?? 0) + step,
      uncertaintyMm: pose.uncertaintyMm,
    })
  }
  return points
}

export function advanceTrajectory(previous: TrajectoryPoint, estimate: PoseEstimate, uncertaintyMm: number | null): TrajectoryPoint {
  return {
    frameIndex: previous.frameIndex + 1,
    matrix: multiplyMat4(previous.matrix, dofToMatrix(estimate.translationMm, estimate.rotationRad)),
    confidence: estimate.confidence,
    cumulativeDistanceMm: previous.cumulativeDistanceMm + lengthOf(estimate.translationMm),
    uncertaintyMm,
  }
}

export function originTrajectory(): TrajectoryPoint {
  return {
    frameIndex: 0,
    matrix: IDENTITY,
    confidence: 1,
    cumulativeDistanceMm: 0,
    uncertaintyMm: 0,
  }
}
