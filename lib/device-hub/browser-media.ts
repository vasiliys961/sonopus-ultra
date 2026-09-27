import type { Raster } from '@/lib/domain/types'
import { createStreamAdapter } from '@/lib/device-hub/stream-adapter'
import type { FrameHost, UltrasoundStreamAdapter } from '@/lib/device-hub/types'

export const SAMPLE_WIDTH = 320
export const SAMPLE_HEIGHT = 240

export function createDomFrameHost(video: HTMLVideoElement, canvas: HTMLCanvasElement): FrameHost {
  canvas.width = SAMPLE_WIDTH
  canvas.height = SAMPLE_HEIGHT
  return {
    async setStream(stream) {
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()
    },
    grab() {
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context || video.readyState < 2) {
        return { width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT, data: new Uint8ClampedArray(SAMPLE_WIDTH * SAMPLE_HEIGHT * 4) }
      }
      context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
      const image = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
      return { width: image.width, height: image.height, data: image.data }
    },
    stop() {
      video.pause()
      video.srcObject = null
    },
  }
}

export function createUvcAdapter(video: HTMLVideoElement, canvas: HTMLCanvasElement): UltrasoundStreamAdapter {
  return createStreamAdapter({
    host: createDomFrameHost(video, canvas),
    acquire: (deviceId) =>
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }),
  })
}

export function createScreenAdapter(video: HTMLVideoElement, canvas: HTMLCanvasElement): UltrasoundStreamAdapter {
  return createStreamAdapter({
    host: createDomFrameHost(video, canvas),
    acquire: () => navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      selfBrowserSurface: 'exclude',
    } as DisplayMediaStreamOptions & { selfBrowserSurface: 'exclude' }),
  })
}

export async function listVideoInputs(): Promise<Array<{ deviceId: string; label: string }>> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Видеовход ${index + 1}`,
    }))
}

export function paintRaster(canvas: HTMLCanvasElement, raster: Raster): void {
  canvas.width = raster.width
  canvas.height = raster.height
  const context = canvas.getContext('2d')
  if (!context) return
  const copy = new Uint8ClampedArray(raster.data)
  context.putImageData(new ImageData(copy, raster.width, raster.height), 0, 0)
}
