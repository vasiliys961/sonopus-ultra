import { describe, expect, it } from 'vitest'
import { computeBladderVolume } from '@/lib/ultrasound-modules/bladder/measurement'
import { thyroidModule } from '@/lib/ultrasound-modules/thyroid/thyroid-module'

const verified = { status: 'verified' as const, source: 'device-calipers' as const, attestedByOperator: true as const }

describe('щитовидная железа', () => {
  it('использует ту же эллипсоидную формулу для каждой доли', () => {
    const lobe = { depthMm: 40, widthMm: 20, heightMm: 15 }
    const result = thyroidModule.computeMeasurement({
      frames: [],
      calibration: verified,
      manual: { kind: 'thyroid', left: lobe, right: lobe },
    })
    const one = computeBladderVolume(40, 20, 15)
    expect(result.raw.volumeLeftMl).toBeCloseTo(one, 5)
    expect(result.raw.volumeRightMl).toBeCloseTo(one, 5)
    expect(result.value).toBeCloseTo(one * 2, 5)
  })

  it('не выдаёт объём без шкалы', () => {
    const result = thyroidModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'нет шкалы' },
      manual: {
        kind: 'thyroid',
        left: { depthMm: 40, widthMm: 20, heightMm: 15 },
        right: { depthMm: 40, widthMm: 20, heightMm: 15 },
      },
    })
    expect(result.value).toBeUndefined()
  })
})
