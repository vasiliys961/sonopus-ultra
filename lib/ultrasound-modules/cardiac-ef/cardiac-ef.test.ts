import { describe, expect, it } from 'vitest'
import type { Point } from '@/lib/domain/types'
import { cardiacEfModule } from '@/lib/ultrasound-modules/cardiac-ef/cardiac-module'
import {
  computeEF,
  diametersFromContour,
  simpsonBiplaneVolumeMl,
  simpsonDisksVolumeMl,
} from '@/lib/ultrasound-modules/cardiac-ef/measurement'

function circle(cx: number, cy: number, radius: number, count = 24): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

describe('фракция выброса', () => {
  it('считает EF по известным EDV и ESV', () => {
    expect(computeEF(120, 48)).toBeCloseTo(60, 5)
    expect(computeEF(100, 100)).toBe(0)
  })

  it('отклоняет нефизичные объёмы', () => {
    expect(() => computeEF(0, 10)).toThrow(/EDV/)
    expect(() => computeEF(80, -1)).toThrow(/ESV/)
    expect(() => computeEF(40, 50)).toThrow(/больше EDV/)
  })

  it('считает одноплоскостной и биплановый Симпсон', () => {
    expect(simpsonDisksVolumeMl([40, 40], 10)).toBeCloseTo((Math.PI / 4) * 3200 * 10 / 1000, 5)
    expect(simpsonBiplaneVolumeMl([40], [20], 10)).toBeCloseTo((Math.PI / 4) * 800 * 10 / 1000, 5)
    expect(() => simpsonBiplaneVolumeMl([10], [10, 12], 5)).toThrow(/парными/)
  })

  it('достаёт диаметры из контура и не выдумывает объём из трёх точек', () => {
    const disks = diametersFromContour(circle(80, 80, 30))
    expect(disks).not.toBeNull()
    expect(disks?.longAxisPx).toBeGreaterThan(55)
    expect(disks?.longAxisPx).toBeLessThan(65)
    expect(Math.max(...(disks?.diametersPx ?? []))).toBeGreaterThan(50)
    expect(diametersFromContour([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }])).toBeNull()
  })

  it('не переводит EDV/ESV в проценты без шкалы', () => {
    const result = cardiacEfModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'нет шкалы' },
      manual: { kind: 'cardiac-ef', edvMl: 120, esvMl: 48 },
    })
    expect(result.value).toBeUndefined()
  })

  it('считает EF по введённым объёмам при подтверждённых калиперах', () => {
    const result = cardiacEfModule.computeMeasurement({
      frames: [],
      calibration: { status: 'verified', source: 'device-calipers', attestedByOperator: true },
      manual: { kind: 'cardiac-ef', edvMl: 120, esvMl: 48 },
    })
    expect(result.value).toBeCloseTo(60, 5)
    expect(result.unit).toBe('percent')
    expect(result.clinicallyValidated).toBe(false)
  })
})
