import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export type SliceAxis = 'x' | 'y' | 'z'

export interface OrthogonalSlice {
  axis: SliceAxis
  index: number
  width: number
  height: number
  rgba: Uint8ClampedArray
}

function toneOf(volume: ReconstructedVolume, index: number): number | null {
  if (volume.observed[index] === 1) return volume.scalars[index] ?? 0
  return null
}

/** Срез только по увиденным вокселям. Unknown остаётся прозрачным. */
export function orthogonalSlice(volume: ReconstructedVolume, axis: SliceAxis, index: number): OrthogonalSlice {
  const [sx, sy, sz] = volume.size
  const width = axis === 'x' ? sy : sx
  const height = axis === 'z' ? sy : sz
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const x = axis === 'x' ? index : col
      const y = axis === 'x' ? col : axis === 'y' ? index : col
      const z = axis === 'z' ? index : row
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue
      const toneValue = toneOf(volume, voxelIndex(volume.size, x, y, z))
      if (toneValue == null) continue
      const tone = Math.max(0, Math.min(255, Math.round(toneValue * 255)))
      const pixel = (row * width + col) * 4
      rgba[pixel] = tone
      rgba[pixel + 1] = tone
      rgba[pixel + 2] = tone
      rgba[pixel + 3] = 255
    }
  }
  return { axis, index, width, height, rgba }
}

export function middleObservedIndex(volume: ReconstructedVolume, axis: SliceAxis): number {
  const limit = axis === 'x' ? volume.size[0] : axis === 'y' ? volume.size[1] : volume.size[2]
  let best = 0
  let bestCount = -1
  for (let index = 0; index < limit; index += 1) {
    const slice = orthogonalSlice(volume, axis, index)
    let count = 0
    for (let pixel = 3; pixel < slice.rgba.length; pixel += 4) if ((slice.rgba[pixel] ?? 0) > 0) count += 1
    if (count > bestCount) {
      best = index
      bestCount = count
    }
  }
  return best
}
