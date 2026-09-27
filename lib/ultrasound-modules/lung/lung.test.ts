import { describe, expect, it } from 'vitest'
import { countVerticalBrightLines } from '@/lib/ultrasound-modules/lung/measurement'
import { lungModule } from '@/lib/ultrasound-modules/lung/lung-module'

function withLines(xs: number[]): Float32Array {
  const width = 80
  const height = 40
  const gray = new Float32Array(width * height).fill(0.1)
  for (const x of xs) {
    for (let y = 0; y < height; y += 1) gray[y * width + x] = 1
  }
  return gray
}

describe('лёгкие', () => {
  it('считает отдельные яркие столбцы и склеивает соседние', () => {
    expect(countVerticalBrightLines(withLines([10, 30, 50]), 80, 40)).toBe(3)
    expect(countVerticalBrightLines(withLines([10, 11, 12]), 80, 40)).toBe(1)
  })

  it('принимает ручной подсчёт по четырём зонам и отклоняет мусор', () => {
    const ok = lungModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'счётчик' },
      manual: { kind: 'lung', zoneCounts: { 'right-upper': 1, 'right-lower': 0, 'left-upper': 3, 'left-lower': 2 } },
    })
    expect(ok.value).toBe(6)
    const bad = lungModule.computeMeasurement({
      frames: [],
      calibration: { status: 'unavailable', reason: 'счётчик' },
      manual: { kind: 'lung', zoneCounts: { 'right-upper': 1.5, 'right-lower': 0, 'left-upper': 0, 'left-lower': 0 } },
    })
    expect(bad.value).toBeUndefined()
  })
})
