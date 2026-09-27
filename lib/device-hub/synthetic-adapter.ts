import type { UltrasoundFrame } from '@/lib/domain/types'
import type { UltrasoundStreamAdapter } from '@/lib/device-hub/types'
import { renderSyntheticRaster, type SyntheticScene } from '@/lib/device-hub/synthetic-frame'

export function createSyntheticAdapter(deps: {
  getScene: () => Partial<SyntheticScene>
  intervalMs?: number
  now?: () => number
}): UltrasoundStreamAdapter {
  let timer: ReturnType<typeof setInterval> | null = null
  let sequence = 0
  let token = 0
  const listeners = new Set<(frame: UltrasoundFrame) => void>()

  return {
    async connect() {
      token += 1
      const current = token
      if (timer) clearInterval(timer)
      timer = setInterval(() => {
        if (current !== token) return
        const scene = deps.getScene()
        const frame: UltrasoundFrame = {
          imageData: renderSyntheticRaster({ ...scene, phase: sequence / 10 }),
          timestamp: deps.now ? deps.now() : Date.now(),
          sequenceNumber: sequence,
        }
        sequence += 1
        for (const listener of listeners) listener(frame)
      }, deps.intervalMs ?? 100)
    },
    onFrame(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    disconnect() {
      token += 1
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
