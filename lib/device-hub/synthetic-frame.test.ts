import { describe, expect, it } from 'vitest'
import { renderSyntheticRaster } from '@/lib/device-hub/synthetic-frame'
import { fitGray, matchShift } from '@/lib/intelligence/gray'
import { rasterToGray } from '@/lib/quality/gray'

function plane(sweep: number) {
  const raster = renderSyntheticRaster({ sweep })
  return fitGray(rasterToGray(raster), raster.width, raster.height)
}

describe('practice sweep', () => {
  it('moves the mark far enough that a later frame is not the same cut', () => {
    expect(matchShift(plane(0), plane(1)).similarity).toBeLessThan(0.93)
    expect(matchShift(plane(0), plane(1 / 3)).similarity).toBeLessThan(0.93)
  })
})
