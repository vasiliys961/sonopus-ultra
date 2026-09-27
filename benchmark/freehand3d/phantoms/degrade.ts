import type { SweepFrame } from '@/benchmark/freehand3d/phantoms/sweep'

export type NoiseLevel = 'none' | 'medium' | 'high'

function hash(seed: number): number {
  let value = seed | 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function unitNoise(seed: number): number {
  return (hash(seed) + hash(seed + 101) + hash(seed + 307)) / 3 - 0.5
}

function copyFrame(frame: SweepFrame, image: Float32Array, fieldMask: Uint8Array): SweepFrame {
  return { ...frame, image, fieldMask }
}

export function degradeFrames(frames: readonly SweepFrame[], level: NoiseLevel): SweepFrame[] {
  if (level === 'none') return frames.map((frame) => copyFrame(frame, frame.image, frame.fieldMask ?? new Uint8Array(frame.image.length)))
  const noiseAmp = level === 'medium' ? 0.12 : 0.45
  const brightness = level === 'medium' ? 0.04 : 0.12
  const contrast = level === 'medium' ? 0.85 : 0.55
  return frames.map((frame, frameIndex) => {
    const image = new Float32Array(frame.image.length)
    for (let pixel = 0; pixel < frame.image.length; pixel += 1) {
      const noise = unitNoise(frameIndex * 100003 + pixel + 1) * 2 * noiseAmp
      image[pixel] = ((frame.image[pixel] ?? 0) - 0.5) * contrast + 0.5 + brightness + noise
    }
    if (level === 'high') {
      const x0 = Math.floor(frame.width * 0.2)
      const x1 = Math.floor(frame.width * 0.55)
      const y0 = Math.floor(frame.height * 0.25)
      const y1 = Math.floor(frame.height * 0.7)
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) image[y * frame.width + x] = 0
      }
    }
    const fieldMask = new Uint8Array(frame.image.length)
    for (let pixel = 0; pixel < image.length; pixel += 1) fieldMask[pixel] = (image[pixel] ?? 0) > 0.55 ? 1 : 0
    return copyFrame(frame, image, fieldMask)
  })
}

export function dropFrames(frames: readonly SweepFrame[], percent: number): SweepFrame[] {
  if (percent <= 0 || frames.length < 2) return [...frames]
  const drop = Math.round(((frames.length - 1) * percent) / 100)
  if (drop <= 0) return [...frames]
  const stride = Math.max(1, Math.floor((frames.length - 1) / drop))
  const dropped = new Set<number>()
  for (let index = stride; dropped.size < drop && index < frames.length; index += stride) dropped.add(index)
  return frames.filter((_, index) => !dropped.has(index))
}
