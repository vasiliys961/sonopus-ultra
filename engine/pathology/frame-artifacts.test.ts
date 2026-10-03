import { describe, expect, it } from 'vitest'
import { atlasPrior } from '@/engine/atlas/catalog'
import { scanFrameArtifacts } from '@/engine/pathology/frame-artifacts'

function plane(width: number, height: number, paint: (gray: Float32Array) => void) {
  const gray = new Float32Array(width * height)
  paint(gray)
  return { gray, width, height }
}

describe('frame artifacts', () => {
  it('marks repeating bands and a dark column, and does not call them a lesion', () => {
    const bands = plane(8, 16, (gray) => {
      for (let y = 0; y < 16; y += 1) {
        const tone = y % 3 === 0 ? 0.85 : 0.12
        for (let x = 0; x < 8; x += 1) gray[y * 8 + x] = tone
      }
    })
    const column = plane(12, 12, (gray) => {
      gray.fill(0.5)
      for (let y = 0; y < 12; y += 1) gray[y * 12 + 5] = 0.02
    })
    const notes = scanFrameArtifacts([bands, column])
    expect(notes.map((item) => item.id)).toEqual(['artifact-reverb', 'artifact-dropout'])
  })

  it('keeps a thyroid prior unobserved and separate from the liver list', () => {
    const thyroid = atlasPrior('thyroid')
    expect(thyroid.every((node) => node.observed === false)).toBe(true)
    expect(thyroid.some((node) => node.name === 'воротная вена')).toBe(false)
    expect(thyroid.some((node) => node.name === 'перешеек')).toBe(true)
  })
})
