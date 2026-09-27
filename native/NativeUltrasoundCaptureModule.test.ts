import { describe, expect, it } from 'vitest'
import { createNativeScreenAdapter, type NativeCaptureBridge, type NativeCapturedFrame } from '@/native/NativeUltrasoundCaptureModule'

function fakeBridge(): NativeCaptureBridge & { emit: (frame: NativeCapturedFrame) => void } {
  let listener: ((frame: NativeCapturedFrame) => void) | null = null
  return {
    start: async () => undefined,
    stop: () => undefined,
    subscribe(onFrame) {
      listener = onFrame
      return () => {
        listener = null
      }
    },
    emit(frame) {
      listener?.(frame)
    },
  }
}

describe('нативный захват экрана', () => {
  it('отдаёт кадр в том же виде, что браузерный поток', async () => {
    const bridge = fakeBridge()
    const adapter = createNativeScreenAdapter(bridge)
    const frames: number[] = []
    await adapter.connect()
    const stop = adapter.onFrame((frame) => frames.push(frame.sequenceNumber))
    bridge.emit({ rgba: new Uint8ClampedArray(16), width: 2, height: 2, timestamp: 10 })
    stop()
    adapter.disconnect()
    bridge.emit({ rgba: new Uint8ClampedArray(16), width: 2, height: 2, timestamp: 20 })
    expect(frames).toEqual([1])
  })
})
