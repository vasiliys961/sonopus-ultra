import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface ObliqueSlice {
  kind: 'RECONSTRUCTED'
  width: number
  height: number
  rgba: Uint8ClampedArray
}

/** Косой срез через узел сетки. Это не исходный кадр прохода. */
export function obliqueSlice(
  volume: ReconstructedVolume,
  center: { x: number; y: number; z: number },
  tiltRad: number,
): ObliqueSlice {
  const [sx, sy, sz] = volume.size
  const width = Math.max(1, sx)
  const height = Math.max(1, sy)
  const rgba = new Uint8ClampedArray(width * height * 4)
  const cos = Math.cos(tiltRad)
  const sin = Math.sin(tiltRad)
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const along = row - height / 2
      const x = col
      const y = Math.round(center.y + along * cos)
      const z = Math.round(center.z + along * sin)
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue
      const index = voxelIndex(volume.size, x, y, z)
      if (volume.observed[index] !== 1) continue
      const tone = Math.max(0, Math.min(255, Math.round((volume.scalars[index] ?? 0) * 255)))
      const pixel = (row * width + col) * 4
      rgba[pixel] = tone
      rgba[pixel + 1] = tone
      rgba[pixel + 2] = tone
      rgba[pixel + 3] = 255
    }
  }
  return { kind: 'RECONSTRUCTED', width, height, rgba }
}
