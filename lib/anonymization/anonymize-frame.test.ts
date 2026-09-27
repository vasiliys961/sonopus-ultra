import { describe, expect, it } from 'vitest'
import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'
import { bytesToBase64, base64ToBytes } from '@/lib/image/base64'
import { encodePng } from '@/lib/image/png-encode'

describe('приватность кадра', () => {
  it('закрашивает верхнюю полосу и сохраняет центр', () => {
    const data = new Uint8ClampedArray(20 * 20 * 4).fill(255)
    const masked = anonymizeRaster({ width: 20, height: 20, data })
    expect(masked.data[0]).toBe(0)
    const center = (10 * 20 + 10) * 4
    expect(masked.data[center]).toBe(255)
    expect(data[0]).toBe(255)
  })

  it('кодирует PNG и обратимо упаковывает RGBA', () => {
    const png = encodePng({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(7) })
    expect([...png.subarray(0, 4)]).toEqual([137, 80, 78, 71])
    const bytes = Uint8Array.from([0, 1, 2, 250, 255])
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
  })
})
