import type { AnatomyObservation } from '@/lib/vision-engine/anatomy/anatomy-detector'
import type { PlaneObservation } from '@/lib/vision-engine/plane/plane-detector'

export interface TemporalState {
  anatomy: AnatomyObservation | null
  plane: PlaneObservation | null
  confidenceHistory: number[]
  stableForMs: number
  state: 'unstable' | 'tracking' | 'stable' | 'lost'
}

const EMPTY: TemporalState = {
  anatomy: null,
  plane: null,
  confidenceHistory: [],
  stableForMs: 0,
  state: 'unstable',
}

export class TemporalTracker {
  private state: TemporalState = { ...EMPTY, confidenceHistory: [] }
  private key: string | null = null
  private since: number | null = null

  current(): TemporalState {
    return this.state
  }

  push(sample: { at: number; anatomy: AnatomyObservation | null; plane: PlaneObservation | null }, stableMs = 1000): TemporalState {
    const nextKey = sample.anatomy ? `${sample.anatomy.organ}:${sample.anatomy.laterality}:${sample.plane?.type ?? 'unknown'}` : null
    const history = [...this.state.confidenceHistory, sample.anatomy?.confidence ?? 0].slice(-20)
    if (!sample.anatomy) {
      this.key = null
      this.since = null
      this.state = {
        anatomy: null,
        plane: sample.plane,
        confidenceHistory: history,
        stableForMs: 0,
        state: this.state.anatomy ? 'lost' : 'unstable',
      }
      return this.state
    }
    if (nextKey !== this.key) {
      this.key = nextKey
      this.since = sample.at
    }
    const stableForMs = this.since === null ? 0 : Math.max(0, sample.at - this.since)
    const steady = stableForMs >= stableMs && sample.anatomy.confidence >= 0.7
    this.state = {
      anatomy: sample.anatomy,
      plane: sample.plane,
      confidenceHistory: history,
      stableForMs,
      state: steady ? 'stable' : 'tracking',
    }
    return this.state
  }
}
