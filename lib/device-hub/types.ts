import type { Raster, SourceType, TrustLevel, UltrasoundFrame } from '@/lib/domain/types'

export type DeviceCapability = 'stream-video' | 'capture-frame' | 'upload-file' | 'receive-dicom'

export interface UltrasoundStreamAdapter {
  connect(deviceId?: string): Promise<void>
  onFrame(cb: (frame: UltrasoundFrame) => void): () => void
  disconnect(): void
}

export interface FrameHost {
  setStream(stream: MediaStream): Promise<void>
  grab(): Raster
  stop(): void
}

export const SOURCE_TRUST: Record<SourceType, TrustLevel> = {
  uvc: 'high',
  hdmi: 'high',
  dicom: 'high',
  'screen-capture': 'low',
  synthetic: 'low',
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
