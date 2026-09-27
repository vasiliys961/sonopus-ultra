import type { Raster } from '@/lib/domain/types'
import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'

export interface TrainingFrame {
  organModule: string
  qualityScore: number
  timestamp: number
  raster: Raster
}

/** Обезличенные кадры только в памяти вкладки и только после отдельного согласия. */
export class TrainingFrameLog {
  private readonly frames: TrainingFrame[] = []

  constructor(private readonly limit = 20) {}

  add(frame: Omit<TrainingFrame, 'raster'> & { raster: Raster }, consent: boolean): void {
    if (!consent) return
    this.frames.push({ ...frame, raster: anonymizeRaster(frame.raster) })
    if (this.frames.length > this.limit) this.frames.shift()
  }

  count(): number {
    return this.frames.length
  }

  snapshot(): TrainingFrame[] {
    return this.frames.map((frame) => ({ ...frame, raster: { ...frame.raster, data: frame.raster.data.slice() } }))
  }

  clear(): void {
    this.frames.length = 0
  }
}
