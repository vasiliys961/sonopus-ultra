import { describe, expect, it } from 'vitest'
import { readCrossSection, readCrossSeries } from '@/lib/dicom/cross-section'
import { buildGrayDicom, buildGraySeries, buildPixelSpacingDicom } from '@/lib/dicom/synthetic-dicom'

describe('DICOM cross section', () => {
  it('reads an uncompressed gray slice and stretches it for display', () => {
    const bytes = buildGrayDicom('MR', Uint8Array.from([0, 100, 200, 255]), 2, 2)
    const read = readCrossSection(bytes)
    expect(read.reason).toBeNull()
    expect(read.section?.modality).toBe('MR')
    expect(read.section?.width).toBe(2)
    expect(read.section?.gray[0]).toBeCloseTo(0, 5)
    expect(read.section?.gray[3]).toBeCloseTo(1, 5)
  })

  it('pages a multi-frame series and keeps the recorded step', () => {
    const bytes = buildGraySeries('MR', [
      Uint8Array.from([0, 10, 20, 40]),
      Uint8Array.from([0, 80, 160, 255]),
    ], 2, 2)
    const read = readCrossSeries([bytes])
    expect(read.reason).toBeNull()
    expect(read.series?.frames).toHaveLength(2)
    expect(read.series?.frames[0]?.[0]).toBeCloseTo(0, 5)
    expect(read.series?.frames[1]?.[3]).toBeCloseTo(1, 5)
    expect(read.series?.sliceStepMm).toBeCloseTo(1.5, 5)
  })

  it('does not stack slices of different size', () => {
    const small = buildGrayDicom('CT', Uint8Array.from([0, 255, 0, 255]), 2, 2)
    const wide = buildGrayDicom('CT', Uint8Array.from([0, 1, 2, 3, 4, 5]), 3, 2)
    const read = readCrossSeries([small, wide])
    expect(read.series).toBeNull()
    expect(read.reason).toContain('разного')
  })

  it('does not invent a slice when pixel data is absent', () => {
    const read = readCrossSection(buildPixelSpacingDicom(0.5, 0.5, 'CT'))
    expect(read.section).toBeNull()
    expect(read.reason).toContain('нет')
  })
})
