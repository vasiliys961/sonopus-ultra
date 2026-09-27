import { describe, expect, it } from 'vitest'
import { brain2SystemPrompt } from '@/lib/prompts/sonographer-differential'
import { MULTI_ANGLE_VIEWS, multiAngleModule } from '@/lib/ultrasound-modules/multi-angle/multi-angle-module'

describe('несколько ракурсов', () => {
  it('просит пять заявленных положений датчика и подсказывает недостающий поворот', () => {
    expect(multiAngleModule.requiredViews).toEqual([...MULTI_ANGLE_VIEWS])
    expect(multiAngleModule.guidance.map((step) => step.view)).toEqual([...MULTI_ANGLE_VIEWS])
    expect(multiAngleModule.guidance.find((step) => step.view === 'angle-45')?.text).toMatch(/45/)
    expect(multiAngleModule.requiresSpatialScale).toBe(false)
  })

  it('считает снятые ракурсы и не строит объём', () => {
    const empty = multiAngleModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'шкала не нужна' },
    })
    expect(empty.value).toBeUndefined()
    expect(empty.raw.reason).toMatch(/ракурс/)

    const partial = multiAngleModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'шкала не нужна' },
      viewQuality: { 'angle-0': 0.9, 'angle-45': 0.8, 'angle-90': 0.2 },
    })
    expect(partial.value).toBe(2)
    expect(partial.unit).toBe('count')
    expect(partial.raw.missing).toEqual(['angle-90', 'probe-vertical', 'probe-horizontal'])
    expect(partial.raw.reconstruction).toBe('none')
    expect(partial.clinicallyValidated).toBe(false)
  })

  it('просит вторую модель рассуждать по ракурсам вместе и не собирать 3D', () => {
    const prompt = brain2SystemPrompt()
    expect(prompt).toMatch(/ракурс/)
    expect(prompt).toMatch(/не вычисляй/)
    expect(prompt).not.toMatch(/3D|IMU/)
  })
})