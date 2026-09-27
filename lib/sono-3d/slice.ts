import type { ReconstructedVolume } from '@/lib/sono-3d/types'

export type SliceAxis = 'x' | 'y' | 'z'

export interface OrthogonalSlice {
  axis: SliceAxis
  index: number
  width: number
  height: number
  rgba: Uint8ClampedArray
}

function indexOf(volume: ReconstructedVolume, x: number, y: number, z: number): number {
  return x + volume.size[0] * (y + volume.size[1] * z)
}

/** Срез только по увиденным вокселям. Unknown остаётся чёрным и не дорисовывается. */
export function orthogonalSlice(volume: ReconstructedVolume, axis: SliceAxis, index: number): OrthogonalSlice {
  const [sx, sy, sz] = volume.size
  const width = axis === 'x' ? sy : sx
  const height = axis === 'z' ? sy : sz
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const x = axis === 'x' ? index : col
      const y = axis === 'x' ? col : axis === 'y' ? index : col
      const z = axis === 'z' ? index : axis === 'y' ? row : row
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue
      const cell = indexOf(volume, x, y, z)
      if (volume.observed[cell] !== 1 || volume.prior[cell] === 1) continue
      const tone = Math.max(0, Math.min(255, Math.round((volume.scalars[cell] ?? 0) * 255)))
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
  const [sx, sy, sz] = volume.size
  const limit = axis === 'x' ? sx : axis === 'y' ? sy : sz
  let best = 0
  let bestCount = -1
  for (let index = 0; index < limit; index += 1) {
    let count = 0
    const width = axis === 'x' ? sy : sx
    const height = axis === 'z' ? sy : sz
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const x = axis === 'x' ? index : col
        const y = axis === 'x' ? col : axis === 'y' ? index : col
        const z = axis === 'z' ? index : axis === 'y' ? row : row
        if (volume.observed[indexOf(volume, x, y, z)] === 1) count += 1
      }
    }
    if (count > bestCount) {
      best = index
      bestCount = count
    }
  }
  return best
}
