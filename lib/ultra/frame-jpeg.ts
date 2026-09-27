import { anonymizeRaster } from '@/lib/anonymization/anonymize-frame'
import type { Raster } from '@/lib/domain/types'

let canvas: HTMLCanvasElement | null = null

export function rasterToJpeg(raster: Raster): string {
  const masked = anonymizeRaster(raster)
  if (typeof document === 'undefined') return ''
  if (!canvas) canvas = document.createElement('canvas')
  canvas.width = masked.width
  canvas.height = masked.height
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.putImageData(new ImageData(new Uint8ClampedArray(masked.data), masked.width, masked.height), 0, 0)
  return canvas.toDataURL('image/jpeg', 0.62).replace(/^data:image\/jpeg;base64,/, '')
}

export function jpegToRaster(jpeg: string): Promise<Raster> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const board = document.createElement('canvas')
      board.width = image.naturalWidth
      board.height = image.naturalHeight
      const context = board.getContext('2d')
      if (!context) {
        reject(new Error('кадр не прочитался'))
        return
      }
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, board.width, board.height)
      resolve({ width: board.width, height: board.height, data: pixels.data })
    }
    image.onerror = () => reject(new Error('кадр не прочитался'))
    image.src = `data:image/jpeg;base64,${jpeg}`
  })
}

export function drawJpeg(board: HTMLCanvasElement, jpeg: string) {
  const image = new Image()
  image.onload = () => {
    board.width = image.naturalWidth
    board.height = image.naturalHeight
    board.getContext('2d')?.drawImage(image, 0, 0)
  }
  image.src = `data:image/jpeg;base64,${jpeg}`
}
