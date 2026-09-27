import type { UltrasoundFrame } from '@/lib/domain/types'
import type { FrameMetrics } from '@/lib/vision-engine/types'

export interface BufferedFrame {
  id: string
  frame: UltrasoundFrame
  metrics: FrameMetrics
}

export class FrameBuffer {
  private readonly items: BufferedFrame[] = []

  constructor(private readonly limit = 150) {}

  push(item: BufferedFrame): void {
    this.items.push(item)
    while (this.items.length > this.limit) this.items.shift()
  }

  latest(): BufferedFrame | null {
    return this.items[this.items.length - 1] ?? null
  }

  acceptedSince(timestamp: number): BufferedFrame[] {
    return this.items.filter((item) => item.metrics.timestamp >= timestamp)
  }

  all(): readonly BufferedFrame[] {
    return this.items
  }
}
