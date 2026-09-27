import type { VolumeErrorCode } from '@/lib/volume-engine/errors'
import type { PoseEstimate } from '@/lib/volume-engine/pose/PoseProvider'

export interface PoseQcLimits {
  maxStepMm: number
  maxRotationRad: number
  minConfidence: number
  maxUncertaintyMm: number
}

export interface PoseQcFinding {
  code: VolumeErrorCode
  message: string
}

function lengthOf(vector: readonly number[]): number {
  return Math.hypot(vector[0] ?? 0, vector[1] ?? 0, vector[2] ?? 0)
}

export function inspectPose(estimate: PoseEstimate, limits: PoseQcLimits): PoseQcFinding[] {
  const findings: PoseQcFinding[] = []
  if (estimate.confidence < limits.minConfidence) {
    findings.push({ code: 'POSE_LOW_CONFIDENCE', message: 'Low pose confidence' })
  }
  if (lengthOf(estimate.translationMm) > limits.maxStepMm) {
    findings.push({ code: 'POSE_JUMP', message: 'Pose jump detected' })
  }
  if (estimate.rotationRad.some((angle) => Math.abs(angle) > limits.maxRotationRad)) {
    findings.push({ code: 'POSE_JUMP', message: 'Trajectory unstable' })
  }
  return findings
}

export function inspectDrift(uncertaintyMm: number | null, limits: PoseQcLimits): PoseQcFinding | null {
  if (uncertaintyMm == null || uncertaintyMm <= limits.maxUncertaintyMm) return null
  return { code: 'RECONSTRUCTION_UNSTABLE', message: 'Accumulated drift high' }
}
