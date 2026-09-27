import { describe, expect, it } from 'vitest'
import { dofToMatrix, transformPoint } from '@/lib/spatial-reconstruction/rigid'
import { compoundSweep } from '@/lib/sono-3d/compound'
import { invertMat4, nearlyIdentity, roundTrip } from '@/lib/sono-3d/inverse'
import { referenceGapPhantom, sensorlessUnavailable } from '@/lib/sono-3d/phantom'
import { physicalMeasuresAllowed, POSE_MODEL_UNAVAILABLE } from '@/lib/sono-3d/types'

describe('отдельный Sono 3D', () => {
  it('возвращает точку после поворота и переноса', () => {
    const matrix = dofToMatrix([4, -2, 7], [0.2, -0.3, 0.4])
    expect(nearlyIdentity(roundTrip(matrix))).toBe(true)
    const point = transformPoint(matrix, [1, 2, 3])
    const back = transformPoint(invertMat4(matrix), point)
    expect(back[0]).toBeCloseTo(1)
    expect(back[1]).toBeCloseTo(2)
    expect(back[2]).toBeCloseTo(3)
  })

  it('оставляет промежуток между эталонными плоскостями пустым', () => {
    const volume = referenceGapPhantom()
    expect(volume.poseMode).toBe('reference_test')
    expect(volume.status).toBe('validated_reference')
    expect(volume.clinicallyValidated).toBe(false)
    expect(volume.observed.reduce((sum, bit) => sum + bit, 0)).toBe(2)
    expect(volume.interpolated.every((bit) => bit === 0)).toBe(true)
    expect(volume.prior.every((bit) => bit === 0)).toBe(true)
    expect(volume.size[2]).toBeGreaterThan(2)
    expect(physicalMeasuresAllowed(volume)).toBe(true)
  })

  it('без шкалы не выдаёт миллиметры', () => {
    const frame = referenceGapPhantom()
    expect(frame.spacingMm).not.toBeNull()
    const blocked = compoundSweep([{
      gray: new Float32Array([1]),
      width: 1,
      height: 1,
      field: Uint8Array.from([1]),
      mmPerPixelX: null,
      mmPerPixelY: null,
      pose: {
        frameIndex: 0,
        matrix: dofToMatrix([0, 0, 0], [0, 0, 0]),
        source: 'reference',
        uncertaintyMm: null,
        algorithmVersion: 'reference-test-1',
      },
    }], 1, 'reference_test')
    expect(blocked.status).toBe('preview_only')
    expect(blocked.spacingMm).toBeNull()
    expect(physicalMeasuresAllowed(blocked)).toBe(false)
  })

  it('sensorless без весов не строит объём', () => {
    const missing = sensorlessUnavailable()
    expect(missing.code).toBe(POSE_MODEL_UNAVAILABLE)
    expect(missing.volume).toBeNull()
  })
})
