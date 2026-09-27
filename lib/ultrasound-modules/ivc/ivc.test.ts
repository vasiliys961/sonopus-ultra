import { describe, expect, it } from 'vitest'
import { ivcModule } from '@/lib/ultrasound-modules/ivc/ivc-module'
import { computeCollapsibilityIndex, estimateAnechoicDiameterPx } from '@/lib/ultrasound-modules/ivc/measurement'

describe('НПВ', () => {
  it('считает индекс по известной серии', () => {
    expect(computeCollapsibilityIndex([20, 10, 15])).toBeCloseTo(0.5, 5)
    expect(computeCollapsibilityIndex([15, 15])).toBe(0)
  })

  it('отклоняет пустую, короткую и нефизичную серию', () => {
    expect(() => computeCollapsibilityIndex([])).toThrow(/двух/)
    expect(() => computeCollapsibilityIndex([12])).toThrow(/двух/)
    expect(() => computeCollapsibilityIndex([0, 10])).toThrow(/больше нуля/)
    expect(() => computeCollapsibilityIndex([-2, 10])).toThrow(/больше нуля/)
  })

  it('находит анэхогенный просвет между яркими стенками', () => {
    const width = 30
    const gray = new Float32Array(width).fill(0.8)
    for (let x = 5; x < 15; x += 1) gray[x] = 0.1
    expect(estimateAnechoicDiameterPx(gray, width, 1, 0)).toBe(10)
    expect(estimateAnechoicDiameterPx(gray, width, 1, 4)).toBeNull()
  })

  it('даёт безразмерный индекс по пикселям и не публикует миллиметры', () => {
    const result = ivcModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'нет шкалы' },
      diameterSeriesPx: [20, 10],
    })
    expect(result.value).toBeCloseTo(0.5, 5)
    expect(result.unit).toBe('ratio')
    expect(result.calibration).toBe('unavailable')
    expect(result.raw.millimeters).toBe('unavailable')
  })

  it('не принимает введённые миллиметры без отметки шкалы', () => {
    const result = ivcModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'нет шкалы' },
      manual: { kind: 'ivc', diametersMm: [20, 10] },
    })
    expect(result.value).toBeUndefined()
  })
})
