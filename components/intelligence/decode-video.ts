import { fitGray } from '@/lib/intelligence/gray'
import type { CineFrame } from '@/lib/intelligence/sample-cine'
import { rasterToGray } from '@/lib/quality/gray'
import { sampleTimes } from '@/engine/cine/cine-decoder'

export async function framesFromVideo(file: File): Promise<CineFrame[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await wait(video, 'loadedmetadata')
    if (!Number.isFinite(video.duration)) {
      video.currentTime = 1e10
      await wait(video, 'seeked')
    }
    const times = sampleTimes(video.duration)
    const board = document.createElement('canvas')
    const frames: CineFrame[] = []
    for (let index = 0; index < times.length; index += 1) {
      const at = times[index] ?? 0
      if (Math.abs(video.currentTime - at) > 0.001) {
        video.currentTime = at
        await wait(video, 'seeked')
      }
      const width = video.videoWidth || 160
      const height = video.videoHeight || 120
      board.width = width
      board.height = height
      const context = board.getContext('2d')
      if (!context) continue
      context.drawImage(video, 0, 0, width, height)
      const pixels = context.getImageData(0, 0, width, height)
      const gray = rasterToGray({ width, height, data: pixels.data })
      const plane = fitGray(gray, width, height)
      frames.push({
        id: `video-${index}`,
        timestamp: Math.round(at * 1000),
        quality: contrastScore(plane.gray),
        plane,
      })
    }
    return frames
  } finally {
    URL.revokeObjectURL(url)
  }
}

function contrastScore(gray: Float32Array): number {
  if (gray.length === 0) return 0
  let sum = 0
  let sumSq = 0
  for (const value of gray) {
    sum += value
    sumSq += value * value
  }
  const mean = sum / gray.length
  const variance = Math.max(0, sumSq / gray.length - mean * mean)
  return Math.max(0.25, Math.min(1, Math.sqrt(variance) * 4))
}

function wait(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      video.removeEventListener(event, finish)
      video.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      video.removeEventListener(event, finish)
      video.removeEventListener('error', fail)
      reject(new Error('Видео не прочиталось'))
    }
    video.addEventListener(event, finish)
    video.addEventListener('error', fail)
  })
}
