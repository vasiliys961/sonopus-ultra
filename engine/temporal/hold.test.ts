import { describe, expect, it } from 'vitest'
import { echoHold, slicePixel } from '@/engine/temporal/hold'

function plane(id: string, fill: number, darkAt: { x: number; y: number } | null): { id: string; gray: Float32Array; width: number; height: number } {
  const width = 12
  const height = 8
  const gray = new Float32Array(width * height)
  gray.fill(fill)
  if (darkAt) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const yy = darkAt.y + dy
        const xx = darkAt.x + dx
        if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue
        gray[yy * width + xx] = 0.02
      }
    }
  }
  return { id, gray, width, height }
}

describe('echo hold across matched frames', () => {
  it('counts only the matched frames that keep the same sign', () => {
    const frames = [
      plane('a', 0.4, { x: 4, y: 3 }),
      plane('b', 0.4, { x: 4, y: 3 }),
      plane('c', 0.4, null),
    ]
    const hold = echoHold('hypoechoic', 4, 3, frames, ['a', 'b', 'c', 'missing'])
    expect(hold.matched).toBe(3)
    expect(hold.sameSign).toBe(2)
  })

  it('maps a volume voxel back to the centered frame', () => {
    const pixel = slicePixel(-6, -4, 1, 1, 6, 4, 12, 8)
    expect(pixel.x).toBeCloseTo(5.5)
    expect(pixel.y).toBeCloseTo(3.5)
  })
})
