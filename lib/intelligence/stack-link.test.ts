import { describe, expect, it } from 'vitest'
import { axialIndexForDepth, cineIndexForAxial } from '@/lib/intelligence/stack-link'

describe('cine and axial link', () => {
  const slices = [{ depth: 0 }, { depth: 0.45 }, { depth: 1.35 }]

  it('maps a frame depth onto the axial stack and back to the nearest frame', () => {
    expect(axialIndexForDepth(0, 1, 8, 1.35)).toBe(1)
    expect(cineIndexForAxial(slices, 0, 1, 1)).toBe(2)
    expect(axialIndexForDepth(0, 1, 8, 0)).toBe(0)
    expect(cineIndexForAxial(slices, 0, 1, 0)).toBe(0)
  })

  it('keeps the index inside the volume', () => {
    expect(axialIndexForDepth(-2, 1, 4, 20)).toBe(3)
  })
})
