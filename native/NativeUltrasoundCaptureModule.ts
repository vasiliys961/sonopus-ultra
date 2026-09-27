import type { UltrasoundStreamAdapter } from '@/lib/device-hub/types'

export interface NativeCapturedFrame {
  rgba: Uint8ClampedArray
  width: number
  height: number
  timestamp: number
}

export interface NativeCaptureBridge {
  start(): Promise<void>
  stop(): void
  subscribe(onFrame: (frame: NativeCapturedFrame) => void): () => void
}

/** Тот же контракт, что у браузерного потока. Кадр приходит из ReplayKit или MediaProjection. */
export function createNativeScreenAdapter(bridge: NativeCaptureBridge): UltrasoundStreamAdapter {
  let sequence = 0
  let unsubscribe: () => void = () => undefined
  return {
    async connect() {
      await bridge.start()
    },
    onFrame(cb) {
      unsubscribe = bridge.subscribe((frame) => {
        sequence += 1
        cb({
          timestamp: frame.timestamp,
          sequenceNumber: sequence,
          imageData: { width: frame.width, height: frame.height, data: frame.rgba },
        })
      })
      return () => unsubscribe()
    },
    disconnect() {
      unsubscribe()
      bridge.stop()
    },
  }
}
