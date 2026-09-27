import { describe, expect, it } from 'vitest'
import { bladderModule } from '@/lib/ultrasound-modules/bladder/bladder-module'
import { computeBladderVolume } from '@/lib/ultrasound-modules/bladder/measurement'

const verified = { status: 'verified' as const, source: 'device-calipers' as const, attestedByOperator: true as const }

describe('мочевой пузырь', () => {
  it('считает 10 × 8 × 6 см как 249.6 мл', () => {
    expect(computeBladderVolume(100, 80, 60)).toBeCloseTo(249.6, 5)
  })

  it('отклоняет нулевые, огромные и нечисловые размеры', () => {
    expect(() => computeBladderVolume(0, 80, 60)).toThrow(/больше нуля/)
    expect(() => computeBladderVolume(100, -1, 60)).toThrow(/больше нуля/)
    expect(() => computeBladderVolume(300, 80, 60)).toThrow(/границу/)
    expect(() => computeBladderVolume(Number.NaN, 80, 60)).toThrow(/конечное/)
  })

  it('не выдаёт миллилитры без подтверждённой шкалы', () => {
    const result = bladderModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'нет шкалы' },
      manual: { kind: 'bladder', depthMm: 100, widthMm: 80, heightMm: 60 },
    })
    expect(result.value).toBeUndefined()
    expect(result.calibration).toBe('unavailable')
    expect(result.clinicallyValidated).toBe(false)
    expect(result.formulaSource).toBe('published-literature')
    expect(bladderModule.toFindingsPayload(result).volume_ml).toBeUndefined()
  })

  it('возвращает объём, когда шкала и три размера подтверждены', () => {
    const result = bladderModule.computeMeasurement({
      frames: [],
      calibration: verified,
      manual: { kind: 'bladder', depthMm: 100, widthMm: 80, heightMm: 60 },
      viewQuality: { transverse: 0.8, longitudinal: 0.9 },
    })
    expect(result.value).toBeCloseTo(249.6, 5)
    expect(result.unit).toBe('ml')
    expect(result.raw.view_transverse_quality).toBe(0.8)
  })
})
