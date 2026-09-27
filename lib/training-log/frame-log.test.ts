import { describe, expect, it } from 'vitest'
import { TrainingFrameLog } from '@/lib/training-log/frame-log'

describe('лог кадров для будущей модели', () => {
  it('без согласия не хранит кадр, с согласием закрашивает полосу с фамилией', () => {
    const log = new TrainingFrameLog()
    const raster = { width: 4, height: 4, data: new Uint8ClampedArray(64).fill(255) }
    log.add({ organModule: 'bladder', qualityScore: 0.9, timestamp: 1, raster }, false)
    expect(log.count()).toBe(0)
    log.add({ organModule: 'bladder', qualityScore: 0.9, timestamp: 1, raster }, true)
    expect(log.count()).toBe(1)
    expect(log.snapshot()[0]?.raster.data[0]).toBe(0)
    expect(raster.data[0]).toBe(255)
  })
})
