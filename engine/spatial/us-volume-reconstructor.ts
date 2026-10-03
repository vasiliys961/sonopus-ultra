import { buildSpatialPreview, type SpatialPreview } from '@/lib/intelligence/build-preview'
import type { CineFrame, CineSampleOptions } from '@/lib/intelligence/sample-cine'

/** Адаптер к существующему Volume Engine. Второй сплаттер не заводится. */
export function reconstructUltrasound(frames: readonly CineFrame[], sample: CineSampleOptions = {}): Promise<SpatialPreview> {
  return buildSpatialPreview(frames, sample)
}
