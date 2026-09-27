import { reconstructScan } from '@/lib/spatial-reconstruction/reconstruct'
import type { FramePlane, PoseModel } from '@/lib/spatial-reconstruction/pose-network/pose-model'
import type { TrajectoryPoint } from '@/lib/spatial-reconstruction/types'

export interface Experimental3dResult {
  status: 'disabled' | 'degraded' | 'completed'
  clinicallyValidated: false
  trajectory: TrajectoryPoint[]
  error?: string
}

export function runExperimental3d(enabled: boolean, frames: readonly FramePlane[], model: PoseModel | null): Experimental3dResult {
  if (!enabled) return { status: 'disabled', clinicallyValidated: false, trajectory: [] }
  try {
    return { status: 'completed', clinicallyValidated: false, trajectory: reconstructScan(frames, model).trajectory }
  } catch (error) {
    return {
      status: 'degraded',
      clinicallyValidated: false,
      trajectory: [],
      error: error instanceof Error ? error.message : 'сбой геометрии',
    }
  }
}
