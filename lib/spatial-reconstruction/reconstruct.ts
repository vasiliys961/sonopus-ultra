import { poseEstimate, requirePoseModel, type FramePlane, type PoseModel } from '@/lib/spatial-reconstruction/pose-network/pose-model'
import { integrateTrajectory, stepsFromEstimates } from '@/lib/spatial-reconstruction/trajectory-integrator'
import type { PoseEstimate, TrajectoryPoint } from '@/lib/spatial-reconstruction/types'

export interface ReconstructionGeometry {
  estimates: PoseEstimate[]
  trajectory: TrajectoryPoint[]
}

export function reconstructScan(frames: readonly FramePlane[], model: PoseModel | null): ReconstructionGeometry {
  const poseModel = requirePoseModel(model)
  if (frames.length < 2) throw new Error('для позы нужны два соседних кадра')
  const estimates = frames.slice(1).map((frame, index) => {
    const estimate = poseModel.predictPair(frames[index], frame)
    return poseEstimate(index + 1, estimate.translationMm, estimate.rotationRad, estimate.confidence)
  })
  return {
    estimates,
    trajectory: integrateTrajectory(stepsFromEstimates(estimates)),
  }
}
