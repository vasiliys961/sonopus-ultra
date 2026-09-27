import { describe, expect, it } from 'vitest'
import type { Point } from '@/lib/domain/types'
import { acceptModelContour, mergeModelContours } from '@/lib/ultrasound-modules/cardiac-ef/auto-segmentation'
import { cardiacEfModule } from '@/lib/ultrasound-modules/cardiac-ef/cardiac-module'

function circle(radius: number): Point[] {
  return Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2
    return { x: 40 + Math.cos(angle) * radius, y: 40 + Math.sin(angle) * radius }
  })
}

describe('автоконтур эндокарда', () => {
  it('принимает координаты модели и считает EF той же формулой', () => {
    const manual = mergeModelContours(
      { kind: 'cardiac-ef' },
      [
        { plane: 'a4c', phase: 'diastole', points: circle(20) },
        { plane: 'a4c', phase: 'systole', points: circle(12) },
      ],
    )
    const result = cardiacEfModule.computeMeasurement({
      frames: [],
      calibration: { status: 'verified', mmPerPixel: 0.5, source: 'dicom-pixel-spacing' },
      manual,
    })
    expect(result.raw.method).toBe('simpson-single-plane-model')
    expect(result.value).toBeGreaterThan(0)
    expect(result.clinicallyValidated).toBe(false)
  })

  it('отклоняет контур короче 8 точек', () => {
    expect(() => acceptModelContour({ plane: 'a4c', phase: 'diastole', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toThrow(/8/)
  })
})
