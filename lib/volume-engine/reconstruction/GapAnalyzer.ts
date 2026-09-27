import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'

export type VoxelClass = 'observed' | 'interpolated' | 'unknown'

export function classifyVoxel(observed: Uint8Array, interpolated: Uint8Array, index: number): VoxelClass {
  if (observed[index] === 1) return 'observed'
  if (interpolated[index] === 1) return 'interpolated'
  return 'unknown'
}

/** Заполняет только воксель между двумя уже увиденными соседями. Остальное остаётся unknown. */
export function fillBridgedGaps(
  size: [number, number, number],
  scalars: Float32Array,
  observed: Uint8Array,
  interpolated: Uint8Array,
): void {
  const [sx, sy, sz] = size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 1; x < sx - 1; x += 1) {
        const index = voxelIndex(size, x, y, z)
        if (observed[index] === 1) continue
        const left = voxelIndex(size, x - 1, y, z)
        const right = voxelIndex(size, x + 1, y, z)
        if (observed[left] !== 1 || observed[right] !== 1) continue
        scalars[index] = ((scalars[left] ?? 0) + (scalars[right] ?? 0)) / 2
        interpolated[index] = 1
      }
    }
  }
}
