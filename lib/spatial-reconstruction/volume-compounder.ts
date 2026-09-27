import { assertPositive } from '@/lib/domain/number'
import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3, VolumeEstimate } from '@/lib/spatial-reconstruction/types'

const MAX_EDGE = 32

export interface CompoundFrame {
  gray: Float32Array
  width: number
  height: number
  transform: Mat4
}

function pixelMm(u: number, v: number, width: number, height: number, mmPerPixel: number): Vec3 {
  return [(u + 0.5 - width / 2) * mmPerPixel, (v + 0.5 - height / 2) * mmPerPixel, 0]
}

export function compoundVolume(frames: readonly CompoundFrame[], mmPerPixel: number, voxelMm: number): VolumeEstimate {
  assertPositive(mmPerPixel, 'мм на пиксель')
  assertPositive(voxelMm, 'шаг вокселя')
  if (frames.length === 0) throw new Error('для объёма нужен хотя бы один кадр')

  const samples: Array<{ point: Vec3; gray: number }> = []
  for (const frame of frames) {
    if (frame.gray.length !== frame.width * frame.height) throw new Error('длина кадра не совпадает с шириной и высотой')
    for (let v = 0; v < frame.height; v++) {
      for (let u = 0; u < frame.width; u++) {
        const local = pixelMm(u, v, frame.width, frame.height, mmPerPixel)
        samples.push({ point: transformPoint(frame.transform, local), gray: frame.gray[v * frame.width + u] })
      }
    }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const sample of samples) {
    minX = Math.min(minX, sample.point[0])
    minY = Math.min(minY, sample.point[1])
    minZ = Math.min(minZ, sample.point[2])
    maxX = Math.max(maxX, sample.point[0])
    maxY = Math.max(maxY, sample.point[1])
    maxZ = Math.max(maxZ, sample.point[2])
  }
  const size: [number, number, number] = [
    Math.floor((maxX - minX) / voxelMm) + 1,
    Math.floor((maxY - minY) / voxelMm) + 1,
    Math.floor((maxZ - minZ) / voxelMm) + 1,
  ]
  if (size.some((edge) => edge > MAX_EDGE)) {
    throw new Error(`Сетка объёма больше ${MAX_EDGE} по ребру. Шаг вокселя нужно увеличить.`)
  }
  const cellCount = size[0] * size[1] * size[2]
  const sums = new Float32Array(cellCount)
  const counts = new Uint16Array(cellCount)
  const originMm: Vec3 = [minX, minY, minZ]
  for (const sample of samples) {
    const ix = Math.min(size[0] - 1, Math.max(0, Math.round((sample.point[0] - originMm[0]) / voxelMm)))
    const iy = Math.min(size[1] - 1, Math.max(0, Math.round((sample.point[1] - originMm[1]) / voxelMm)))
    const iz = Math.min(size[2] - 1, Math.max(0, Math.round((sample.point[2] - originMm[2]) / voxelMm)))
    const index = ix + iy * size[0] + iz * size[0] * size[1]
    sums[index] += sample.gray
    counts[index] += 1
  }
  const intensity = new Float32Array(cellCount)
  let occupied = 0
  for (let index = 0; index < cellCount; index++) {
    if (counts[index] === 0) continue
    intensity[index] = sums[index] / counts[index]
    occupied += 1
  }
  return {
    spacingMm: voxelMm,
    originMm,
    size,
    intensity,
    counts,
    occupied,
    clinicallyValidated: false,
    domain: 'geometry-only',
  }
}

export function occupiedCenters(volume: VolumeEstimate): Vec3[] {
  const centers: Vec3[] = []
  const [sx, sy] = volume.size
  for (let iz = 0; iz < volume.size[2]; iz++) {
    for (let iy = 0; iy < sy; iy++) {
      for (let ix = 0; ix < sx; ix++) {
        const index = ix + iy * sx + iz * sx * sy
        if (volume.counts[index] === 0) continue
        centers.push([
          volume.originMm[0] + ix * volume.spacingMm,
          volume.originMm[1] + iy * volume.spacingMm,
          volume.originMm[2] + iz * volume.spacingMm,
        ])
      }
    }
  }
  return centers
}
