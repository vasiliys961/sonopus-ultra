import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import type { Phantom } from '@/benchmark/freehand3d/phantoms/types'
import { voxelCenter } from '@/benchmark/freehand3d/phantoms/metrics'

export function occupancyAt(volume: ReconstructedVolume, point: Vec3): boolean {
  const [sx, sy, sz] = volume.spacingMm
  if (sx <= 0 || sy <= 0 || sz <= 0) return false
  const x = Math.round((point[0] - volume.originMm[0]) / sx)
  const y = Math.round((point[1] - volume.originMm[1]) / sy)
  const z = Math.round((point[2] - volume.originMm[2]) / sz)
  if (x < 0 || y < 0 || z < 0 || x >= volume.size[0] || y >= volume.size[1] || z >= volume.size[2]) return false
  return volume.observed[voxelIndex(volume.size, x, y, z)] === 1
}

function shell(template: ReconstructedVolume, scalars: Float32Array, observed: Uint8Array): ReconstructedVolume {
  const cells = observed.length
  return {
    originMm: template.originMm,
    spacingMm: template.spacingMm,
    size: template.size,
    scalars,
    observed,
    interpolated: new Uint8Array(cells),
    confidence: Float32Array.from(observed),
    coverage: Float32Array.from(observed),
    source: 'ultrasound',
    status: 'preview_only',
    poseMode: 'reference_test',
    clinicallyValidated: false,
  }
}

export function rasterPhantom(phantom: Phantom, template: ReconstructedVolume): ReconstructedVolume {
  const cells = template.size[0] * template.size[1] * template.size[2]
  const scalars = new Float32Array(cells)
  const observed = new Uint8Array(cells)
  const [sx, sy, sz] = template.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (!phantom.contains(voxelCenter(template, x, y, z))) continue
        const index = voxelIndex(template.size, x, y, z)
        scalars[index] = 1
        observed[index] = 1
      }
    }
  }
  return shell(template, scalars, observed)
}

export function differenceVolume(phantom: Phantom, perfect: ReconstructedVolume, registration: ReconstructedVolume): ReconstructedVolume {
  const cells = perfect.size[0] * perfect.size[1] * perfect.size[2]
  const scalars = new Float32Array(cells)
  const observed = new Uint8Array(cells)
  const [sx, sy, sz] = perfect.size
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const point = voxelCenter(perfect, x, y, z)
        const truth = phantom.contains(point)
        const estimated = occupancyAt(registration, point)
        if (!truth && !estimated) continue
        const index = voxelIndex(perfect.size, x, y, z)
        observed[index] = 1
        scalars[index] = truth === estimated ? 0.25 : 1
      }
    }
  }
  return {
    ...shell(perfect, scalars, observed),
    poseMode: 'registration',
    status: 'experimental_estimated',
  }
}
