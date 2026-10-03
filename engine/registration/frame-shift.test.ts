import { describe, expect, it } from 'vitest'
import { affineRegistration } from '@/engine/registration/rigid'
import { frameShift, mapOtherPoint } from '@/engine/registration/frame-shift'

describe('frame shift from explicit points', () => {
  it('moves one series point onto the ultrasound point', () => {
    const shift = frameShift([{ ultrasound: { u: 0.5, v: 0.25 }, other: { u: 0.2, v: 0.1 } }], 40, 20)
    expect(shift?.pairs).toBe(1)
    expect(shift?.confidence).toBe(0.4)
    const landed = mapOtherPoint(shift!, { u: 0.2, v: 0.1 }, 40, 20)
    expect(landed.u).toBeCloseTo(0.5, 4)
    expect(landed.v).toBeCloseTo(0.25, 4)
    expect(affineRegistration().applied).toBe(false)
  })

  it('uses only the first two pairs', () => {
    const shift = frameShift([
      { ultrasound: { u: 0, v: 0 }, other: { u: 0, v: 0 } },
      { ultrasound: { u: 0, v: 1 }, other: { u: 1, v: 0 } },
      { ultrasound: { u: 1, v: 1 }, other: { u: 0, v: 1 } },
    ], 10, 10)
    expect(shift?.pairs).toBe(2)
    expect(shift?.confidence).toBeLessThanOrEqual(0.55)
  })
})
