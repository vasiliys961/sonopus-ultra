import { assertPositive } from '@/lib/domain/number'
import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import type { ReconstructedVolume, SweepFrame } from '@/lib/sono-3d/types'

const MAX_EDGE = 48

function emptyVolume(status: ReconstructedVolume['status'], poseMode: ReconstructedVolume['poseMode']): ReconstructedVolume {
  return {
    originMm: [0, 0, 0],
    spacingMm: null,
    size: [0, 0, 0],
    scalars: new Float32Array(),
    observed: new Uint8Array(),
    interpolated: new Uint8Array(),
    prior: new Uint8Array(),
    status,
    poseMode,
    clinicallyValidated: false,
  }
}

/** Эталонные или явно заданные позы. Пробелы остаются unknown, интерполяция сюда не подмешивается. */
export function compoundSweep(frames: readonly SweepFrame[], voxelMm: number, poseMode: ReconstructedVolume['poseMode']): ReconstructedVolume {
  assertPositive(voxelMm, 'шаг вокселя')
  if (frames.length === 0) return emptyVolume('unavailable', poseMode)
  if (frames.some((frame) => frame.pose.source !== 'reference' && poseMode === 'reference_test')) {
    throw new Error('эталонный проход принимает только позы source reference')
  }
  if (frames.some((frame) => frame.mmPerPixelX == null || frame.mmPerPixelY == null)) {
    return emptyVolume('preview_only', 'demo_without_measures')
  }

  const samples: Array<{ point: Vec3; gray: number }> = []
  for (const frame of frames) {
    if (frame.gray.length !== frame.width * frame.height || frame.field.length !== frame.gray.length) {
      throw new Error('длина кадра не совпадает с шириной и высотой')
    }
    const mmX = frame.mmPerPixelX
    const mmY = frame.mmPerPixelY
    if (mmX == null || mmY == null) continue
    for (let v = 0; v < frame.height; v += 1) {
      for (let u = 0; u < frame.width; u += 1) {
        const index = v * frame.width + u
        if (frame.field[index] !== 1) continue
        const local: Vec3 = [(u + 0.5 - frame.width / 2) * mmX, (v + 0.5 - frame.height / 2) * mmY, 0]
        samples.push({ point: transformPoint(frame.pose.matrix, local), gray: frame.gray[index] })
      }
    }
  }
  if (samples.length === 0) return emptyVolume('unavailable', poseMode)

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
  if (size.some((edge) => edge > MAX_EDGE)) throw new Error(`Сетка объёма больше ${MAX_EDGE} по ребру. Шаг вокселя нужно увеличить.`)
  const cellCount = size[0] * size[1] * size[2]
  const sums = new Float32Array(cellCount)
  const counts = new Uint16Array(cellCount)
  const originMm: Vec3 = [minX, minY, minZ]
  for (const sample of samples) {
    const ix = Math.min(size[0] - 1, Math.max(0, Math.round((sample.point[0] - originMm[0]) / voxelMm)))
    const iy = Math.min(size[1] - 1, Math.max(0, Math.round((sample.point[1] - originMm[1]) / voxelMm)))
    const iz = Math.min(size[2] - 1, Math.max(0, Math.round((sample.point[2] - originMm[2]) / voxelMm)))
    const index = ix + size[0] * (iy + size[1] * iz)
    sums[index] += sample.gray
    counts[index] += 1
  }
  const scalars = new Float32Array(cellCount)
  const observed = new Uint8Array(cellCount)
  for (let index = 0; index < cellCount; index += 1) {
    if (counts[index] === 0) continue
    scalars[index] = sums[index] / counts[index]
    observed[index] = 1
  }
  return {
    originMm,
    spacingMm: voxelMm,
    size,
    scalars,
    observed,
    interpolated: new Uint8Array(cellCount),
    prior: new Uint8Array(cellCount),
    status: poseMode === 'reference_test' ? 'validated_reference' : 'experimental_estimated',
    poseMode,
    clinicallyValidated: false,
  }
}
