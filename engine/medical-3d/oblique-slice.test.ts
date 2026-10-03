import { describe, expect, it } from 'vitest'
import { obliqueSlice } from '@/engine/medical-3d/oblique-slice'
import { orthogonalSlice } from '@/lib/volume-engine/rendering/SliceRenderer'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

function grid(x: number, y: number, z: number): ReconstructedVolume {
  const count = x * y * z
  return {
    originMm: [0, 0, 0],
    spacingMm: [1, 1, 1],
    size: [x, y, z],
    scalars: new Float32Array(count),
    observed: new Uint8Array(count),
    interpolated: new Uint8Array(count),
    confidence: new Float32Array(count),
    coverage: new Float32Array(count),
    source: 'ultrasound',
    status: 'experimental_estimated',
    poseMode: 'unknown',
    clinicallyValidated: false,
  }
}

describe('reconstructed slices', () => {
  it('reads an axial row as y, not as a second copy of x', () => {
    const volume = grid(4, 4, 2)
    volume.scalars[3 * 4 + 1] = 1
    volume.observed[3 * 4 + 1] = 1
    const slice = orthogonalSlice(volume, 'z', 0)
    expect(slice.rgba[(3 * slice.width + 1) * 4 + 3]).toBe(255)
    expect(slice.rgba[(1 * slice.width + 1) * 4 + 3]).toBe(0)
  })

  it('keeps an oblique plane marked reconstructed and on the chosen node', () => {
    const volume = grid(6, 6, 6)
    const index = 4 * 36 + 2 * 6 + 3
    volume.scalars[index] = 0.8
    volume.observed[index] = 1
    const slice = obliqueSlice(volume, { x: 3, y: 2, z: 4 }, 0)
    expect(slice.kind).toBe('RECONSTRUCTED')
    const row = Math.floor(slice.height / 2)
    expect(slice.rgba[(row * slice.width + 3) * 4 + 3]).toBe(255)
  })
})
