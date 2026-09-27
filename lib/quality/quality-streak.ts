import { AUTO_CAPTURE_HOLD_MS, AUTO_CAPTURE_SCORE } from '@/lib/quality/constants'

export interface StreakSnapshot {
  holding: boolean
  heldMs: number
  ready: boolean
}

export class QualityStreakTracker {
  private streakStart: number | null = null

  constructor(
    private readonly threshold = AUTO_CAPTURE_SCORE,
    private readonly holdMs = AUTO_CAPTURE_HOLD_MS,
  ) {}

  push(score: number, timestamp: number): StreakSnapshot {
    if (!Number.isFinite(score) || !Number.isFinite(timestamp)) {
      this.streakStart = null
      return { holding: false, heldMs: 0, ready: false }
    }
    if (score < this.threshold) {
      this.streakStart = null
      return { holding: false, heldMs: 0, ready: false }
    }
    if (this.streakStart === null || timestamp < this.streakStart) {
      this.streakStart = timestamp
    }
    const heldMs = timestamp - this.streakStart
    return { holding: true, heldMs, ready: heldMs >= this.holdMs }
  }

  reset(): void {
    this.streakStart = null
  }
}
