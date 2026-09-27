import type { UltrasoundFrame } from '@/lib/domain/types'
import { stopStream, type FrameHost, type UltrasoundStreamAdapter } from '@/lib/device-hub/types'

export function createStreamAdapter(deps: {
  acquire: (deviceId?: string) => Promise<MediaStream>
  host: FrameHost
  intervalMs?: number
  now?: () => number
}): UltrasoundStreamAdapter {
  let timer: ReturnType<typeof setInterval> | null = null
  let stream: MediaStream | null = null
  let sequence = 0
  let token = 0
  const listeners = new Set<(frame: UltrasoundFrame) => void>()

  const clearTimer = () => {
    if (timer) clearInterval(timer)
    timer = null
  }

  return {
    async connect(deviceId) {
      token += 1
      const current = token
      clearTimer()
      stopStream(stream)
      stream = null
      deps.host.stop()
      const next = await deps.acquire(deviceId)
      if (current !== token) {
        stopStream(next)
        return
      }
      stream = next
      await deps.host.setStream(next)
      if (current !== token) {
        stopStream(next)
        deps.host.stop()
        stream = null
        return
      }
      const intervalMs = deps.intervalMs ?? 100
      timer = setInterval(() => {
        if (current !== token) return
        const frame: UltrasoundFrame = {
          imageData: deps.host.grab(),
          timestamp: deps.now ? deps.now() : Date.now(),
          sequenceNumber: sequence,
        }
        sequence += 1
        for (const listener of listeners) listener(frame)
      }, intervalMs)
    },
    onFrame(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    disconnect() {
      token += 1
      clearTimer()
      deps.host.stop()
      stopStream(stream)
      stream = null
    },
  }
}
