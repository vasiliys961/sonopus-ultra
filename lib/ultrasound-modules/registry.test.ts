import { describe, expect, it, vi } from 'vitest'
import { draftToManual } from '@/lib/ultrasound-modules/manual-draft'
import { listOrganModules } from '@/lib/ultrasound-modules/registry'
import { heuristicQualityScorer } from '@/lib/quality-gate'
import { renderSyntheticRaster } from '@/lib/device-hub/synthetic-frame'
import { rasterToGray } from '@/lib/quality/gray'
import { createStreamAdapter } from '@/lib/device-hub/stream-adapter'
import type { FrameHost } from '@/lib/device-hub/types'

describe('реестр и черновик ввода', () => {
  it('регистрирует модули исследования с формулой из литературы', () => {
    const modules = listOrganModules()
    expect(modules.map((item) => item.id)).toEqual(['bladder', 'ivc', 'efast', 'lung', 'thyroid', 'cardiac-ef', 'multi-angle', 'organ-sweep'])
    for (const module of modules) {
      const result = module.computeMeasurement({
        frames: [],
        calibration: { status: 'unavailable', reason: 'тест' },
      })
      expect(result.formulaSource).toBe('published-literature')
      expect(result.clinicallyValidated).toBe(false)
      expect(module.requiredViews.length).toBeGreaterThan(0)
    }
  })

  it('понимает десятичную запятую и не собирает неполный пузырь', () => {
    const manual = draftToManual('bladder', {
      bladder: { depthMm: '100', widthMm: '80,5', heightMm: '60' },
      ivcDiameters: '',
      efast: { RUQ: null, LUQ: null, pelvis: null, subxiphoid: null },
      lungZones: {},
      thyroidLeft: { depthMm: '', widthMm: '', heightMm: '' },
      thyroidRight: { depthMm: '', widthMm: '', heightMm: '' },
      edvMl: '',
      esvMl: '',
      contours: { a4cDiastole: [], a4cSystole: [], a2cDiastole: [], a2cSystole: [] },
    })
    expect(manual).toMatchObject({ kind: 'bladder', widthMm: 80.5 })
    expect(
      draftToManual('bladder', {
        bladder: { depthMm: '100', widthMm: '', heightMm: '60' },
        ivcDiameters: '',
        efast: { RUQ: null, LUQ: null, pelvis: null, subxiphoid: null },
        lungZones: {},
        thyroidLeft: { depthMm: '', widthMm: '', heightMm: '' },
        thyroidRight: { depthMm: '', widthMm: '', heightMm: '' },
        edvMl: '',
        esvMl: '',
        contours: { a4cDiastole: [], a4cSystole: [], a2cDiastole: [], a2cSystole: [] },
      }),
    ).toBeUndefined()
  })

  it('даёт синтетическому резкому кадру более высокий балл, чем смазанному', () => {
    const sharpRaster = renderSyntheticRaster({ blurPasses: 0, gain: 1, motionShift: 0, phase: 0 })
    const softRaster = renderSyntheticRaster({ blurPasses: 6, gain: 1, motionShift: 0, phase: 0 })
    const sharp = heuristicQualityScorer.score(rasterToGray(sharpRaster), sharpRaster.width, sharpRaster.height, null)
    const soft = heuristicQualityScorer.score(rasterToGray(softRaster), softRaster.width, softRaster.height, null)
    expect(sharp.sharpness).toBeGreaterThan(soft.sharpness)
    expect(sharp.qualityScore).toBeGreaterThanOrEqual(0.75)
    expect(soft.qualityScore).toBeLessThan(sharp.qualityScore)
  })
})

describe('потоковый адаптер', () => {
  it('перестаёт отдавать кадры после disconnect и после отменённого connect', async () => {
    vi.useFakeTimers()
    const frames: number[] = []
    let stopped = false
    const host: FrameHost = {
      async setStream() {},
      grab: () => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) }),
      stop() {
        stopped = true
      },
    }
    const stream = { getTracks: () => [{ stop() { stopped = true } }] } as unknown as MediaStream
    const adapter = createStreamAdapter({
      acquire: async () => stream,
      host,
      intervalMs: 100,
      now: () => 1000,
    })
    adapter.onFrame((frame) => frames.push(frame.sequenceNumber))
    await adapter.connect()
    await vi.advanceTimersByTimeAsync(250)
    adapter.disconnect()
    const count = frames.length
    await vi.advanceTimersByTimeAsync(300)
    expect(count).toBeGreaterThanOrEqual(2)
    expect(frames).toHaveLength(count)
    expect(stopped).toBe(true)

    let release: (value: MediaStream) => void = () => undefined
    const late = createStreamAdapter({
      acquire: () => new Promise<MediaStream>((resolve) => { release = resolve }),
      host,
      intervalMs: 100,
    })
    const pending = late.connect()
    late.disconnect()
    release(stream)
    await pending
    await vi.advanceTimersByTimeAsync(300)
    expect(frames).toHaveLength(count)
    vi.useRealTimers()
  })
})
