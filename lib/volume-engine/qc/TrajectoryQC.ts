import type { TrajectoryPoint } from '@/lib/volume-engine/trajectory/Trajectory'

export interface TrajectoryReport {
  totalDistanceMm: number
  meanStepMm: number
  maxStepMm: number
  meanConfidence: number
  minConfidence: number
  rejectedFrames: number
  rejectionRate: number
  continuityScore: number
}

export function reportTrajectory(points: readonly TrajectoryPoint[], rejectedFrames: number, frameCount: number): TrajectoryReport {
  const steps: number[] = []
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue
    steps.push(current.cumulativeDistanceMm - previous.cumulativeDistanceMm)
  }
  const totalDistanceMm = points[points.length - 1]?.cumulativeDistanceMm ?? 0
  const meanStepMm = steps.length === 0 ? 0 : steps.reduce((sum, step) => sum + step, 0) / steps.length
  const maxStepMm = steps.reduce((max, step) => Math.max(max, step), 0)
  const confidences = points.map((point) => point.confidence)
  const meanConfidence = confidences.length === 0 ? 0 : confidences.reduce((sum, value) => sum + value, 0) / confidences.length
  const minConfidence = confidences.length === 0 ? 0 : Math.min(...confidences)
  const rejectionRate = frameCount === 0 ? 1 : rejectedFrames / frameCount
  const continuityScore = Math.max(0, Math.min(1, (1 - rejectionRate) * (maxStepMm <= 40 ? 1 : 40 / maxStepMm)))
  return {
    totalDistanceMm,
    meanStepMm,
    maxStepMm,
    meanConfidence,
    minConfidence,
    rejectedFrames,
    rejectionRate,
    continuityScore,
  }
}
