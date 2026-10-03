import { describe, expect, it } from 'vitest'
import { crosshairFromClick, pointOnPlane } from '@/lib/volume-engine/rendering/SliceRenderer'

describe('MRI-style crosshair', () => {
  const point = { x: 4, y: 2, z: 7 }

  it('places a click on the two free axes and keeps the plane index', () => {
    expect(crosshairFromClick('z', 1, 5, point)).toEqual({ x: 1, y: 5, z: 7 })
    expect(crosshairFromClick('y', 3, 6, point)).toEqual({ x: 3, y: 2, z: 6 })
    expect(crosshairFromClick('x', 8, 1, point)).toEqual({ x: 4, y: 8, z: 1 })
  })

  it('draws the same point on every plane', () => {
    expect(pointOnPlane('z', point)).toEqual({ col: 4, row: 2 })
    expect(pointOnPlane('y', point)).toEqual({ col: 4, row: 7 })
    expect(pointOnPlane('x', point)).toEqual({ col: 2, row: 7 })
  })
})
