import { describe, expect, it } from 'vitest'
import { inspectDicomBuffer } from '@/lib/dicom/pixel-spacing'
import { buildPixelSpacingDicom } from '@/lib/dicom/synthetic-dicom'

describe('DICOM PixelSpacing', () => {
  it('извлекает известный шаг пикселя и помечает калибровку подтверждённой', () => {
    const inspection = inspectDicomBuffer(buildPixelSpacingDicom(0.5, 0.5))
    expect(inspection.calibration).toBe('verified')
    expect(inspection.mmPerPixel).toBeCloseTo(0.5, 5)
    expect(inspection.modality).toBe('US')
    expect(inspection.pixelSpacingMm).toEqual([0.5, 0.5])
  })

  it('не подтверждает файл без тега и анизотропный шаг', () => {
    const broken = new Uint8Array(16)
    expect(inspectDicomBuffer(broken).calibration).toBe('unavailable')
    const uneven = inspectDicomBuffer(buildPixelSpacingDicom(0.5, 0.8))
    expect(uneven.calibration).toBe('unavailable')
    expect(uneven.mmPerPixel).toBeNull()
  })
})
