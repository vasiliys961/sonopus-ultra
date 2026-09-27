import { describe, expect, it } from 'vitest'
import { guidanceReady, guidanceWaitMs } from '@/lib/guidance/read-pace'

describe('пауза на чтение шага', () => {
  it('в пошаговом режиме не отпускает автосъёмку, пока текст на экране', () => {
    expect(guidanceReady('guided', 1000, 2000, 10_000)).toBe(false)
    expect(guidanceWaitMs('guided', 1000, 2000, 10_000)).toBe(9000)
    expect(guidanceReady('guided', 1000, 11_000, 10_000)).toBe(true)
  })

  it('во втором мнении не задерживает съёмку', () => {
    expect(guidanceReady('second-opinion', 1000, 1000, 10_000)).toBe(true)
    expect(guidanceWaitMs('second-opinion', 1000, 1000, 10_000)).toBe(0)
  })
})