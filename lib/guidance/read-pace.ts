import type { ScanMode } from '@/lib/domain/types'
import { GUIDANCE_READ_MS } from '@/lib/quality/constants'

export function guidanceReady(mode: ScanMode, shownAt: number, now: number, readMs = GUIDANCE_READ_MS): boolean {
  if (mode !== 'guided') return true
  return now - shownAt >= readMs
}

export function guidanceWaitMs(mode: ScanMode, shownAt: number, now: number, readMs = GUIDANCE_READ_MS): number {
  if (mode !== 'guided') return 0
  return Math.max(0, readMs - (now - shownAt))
}
