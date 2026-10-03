import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface VolumePicture {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

/** Проекция максимума поворота вокруг вертикали. Смотрит только наблюдавшиеся воксели. */
export function projectObserved(volume: ReconstructedVolume, yawRad: number): VolumePicture {
  const [sx, sy, sz] = volume.size
  const width = Math.max(1, sx + sz)
  const height = Math.max(1, sy)
  const rgba = new Uint8ClampedArray(width * height * 4)
  if (sx === 0 || sy === 0 || sz === 0) return { width, height, rgba }
  const cos = Math.cos(yawRad)
  const sin = Math.sin(yawRad)
  const cx = (sx - 1) / 2
  const cz = (sz - 1) / 2
  const maxTone = new Float32Array(width * height)
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const cell = voxelIndex(volume.size, x, y, z)
        if (volume.observed[cell] !== 1) continue
        const column = Math.round((x - cx) * cos + (z - cz) * sin + width / 2)
        const row = y
        if (column < 0 || row < 0 || column >= width || row >= height) continue
        const pixel = row * width + column
        const tone = volume.scalars[cell] ?? 0
        if (tone > (maxTone[pixel] ?? 0)) maxTone[pixel] = tone
      }
    }
  }
  for (let index = 0; index < maxTone.length; index += 1) {
    const tone = Math.max(0, Math.min(255, Math.round((maxTone[index] ?? 0) * 255)))
    if (tone === 0) continue
    const pixel = index * 4
    rgba[pixel] = Math.round(tone * 0.75)
    rgba[pixel + 1] = tone
    rgba[pixel + 2] = Math.round(tone * 0.7)
    rgba[pixel + 3] = 255
  }
  return { width, height, rgba }
}
