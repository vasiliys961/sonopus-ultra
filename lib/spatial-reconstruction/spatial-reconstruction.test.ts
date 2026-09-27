import { describe, expect, it } from 'vitest'
import { coverageFromPoints } from '@/lib/spatial-reconstruction/coverage-guidance'
import { scoreReconstruction } from '@/lib/spatial-reconstruction/metrics'
import { poseModelFromOnnx } from '@/lib/spatial-reconstruction/pose-network/onnx-pose'
import { requirePoseModel, type PoseModel } from '@/lib/spatial-reconstruction/pose-network/pose-model'
import { reconstructScan } from '@/lib/spatial-reconstruction/reconstruct'
import { dofToMatrix, IDENTITY, transformPoint } from '@/lib/spatial-reconstruction/rigid'
import { integrateTrajectory } from '@/lib/spatial-reconstruction/trajectory-integrator'
import { compoundVolume, occupiedCenters } from '@/lib/spatial-reconstruction/volume-compounder'

const plane = { gray: new Float32Array([1, 1, 1, 1]), width: 2, height: 2 }

describe('sensorless-реконструкция', () => {
  it('восстанавливает известный перенос и копит неуверенность', () => {
    const trajectory = integrateTrajectory([
      { translationMm: [10, 0, 0], rotationRad: [0, 0, 0], confidence: 0.5 },
      { translationMm: [10, 0, 0], rotationRad: [0, 0, 0], confidence: 0.5 },
      { translationMm: [10, 0, 0], rotationRad: [0, 0, 0], confidence: 0.5 },
    ])
    expect(trajectory[3].translationMm[0]).toBeCloseTo(30)
    expect(trajectory[3].confidence).toBeCloseTo(0.125)
    expect(trajectory[0].transform).toEqual(IDENTITY)
  })

  it('поворачивает плоскость на 90° вокруг Z', () => {
    const matrix = dofToMatrix([0, 0, 0], [0, 0, Math.PI / 2])
    const turned = transformPoint(matrix, [1, 0, 0])
    expect(turned[0]).toBeCloseTo(0)
    expect(turned[1]).toBeCloseTo(1)
  })

  it('без сети позы не выдумывает смещение', () => {
    expect(() => requirePoseModel(null)).toThrow(/не выдумывается/)
    expect(() => reconstructScan([plane, plane], null)).toThrow(/не выдумывается/)
  })

  it('собирает траекторию из шести чисел ONNX и не принимает обрыв вектора', () => {
    const model = poseModelFromOnnx({
      runPair: () => [0, 0, 4, 0, 0, 0],
    }, 1)
    const geometry = reconstructScan([plane, plane, plane], model)
    expect(geometry.trajectory[2].translationMm[2]).toBeCloseTo(8)
    expect(geometry.trajectory[2].confidence).toBe(1)
    expect(() => poseModelFromOnnx({ runPair: () => [1, 2, 3] }).predictPair(plane, plane)).toThrow(/6/)
    expect(() => poseModelFromOnnx({ runPair: () => [1, 2, 3, Number.NaN, 0, 0] }).predictPair(plane, plane)).toThrow(/нечисловую/)
  })

  it('кладёт кадр в воксели по позе и помечает пустые стороны', () => {
    const volume = compoundVolume([{ ...plane, gray: Float32Array.from([1, 0, 0, 0]), transform: IDENTITY }], 1, 1)
    expect(volume.clinicallyValidated).toBe(false)
    expect(volume.occupied).toBeGreaterThan(0)
    const shifted = compoundVolume([
      { ...plane, transform: dofToMatrix([5, 0, 0], [0, 0, 0]) },
    ], 1, 1)
    expect(shifted.originMm[0]).toBeGreaterThan(0)
    const map = coverageFromPoints(occupiedCenters(volume))
    expect(map.missing).toEqual(['+Z', '-Z'])
    expect(map.hints[0]).toMatch(/со стороны \+Z/)
  })

  it('даёт нулевую ошибку на совпавшей траектории и 3 мм при сдвиге', () => {
    const truth = dofToMatrix([0, 0, 0], [0, 0, 0])
    const shifted = dofToMatrix([3, 0, 0], [0, 0, 0])
    const pixels: [number, number, number][] = [[0, 0, 0], [1, 0, 0]]
    const landmarks: [number, number, number][] = [[0, 1, 0]]
    const same = scoreReconstruction({
      globalPixels: [{ predicted: truth, truth }],
      globalLandmarks: [{ predicted: truth, truth }],
      localPixels: [{ predicted: truth, truth }],
      localLandmarks: [{ predicted: truth, truth }],
      pixelsMm: pixels,
      landmarksMm: landmarks,
    })
    expect(same.gpeMm).toBe(0)
    expect(same.lpeMm).toBe(0)
    expect(same.lepMm).toBe(same.lpeMm)
    const moved = scoreReconstruction({
      globalPixels: [{ predicted: shifted, truth }],
      globalLandmarks: [{ predicted: shifted, truth }],
      localPixels: [{ predicted: shifted, truth }],
      localLandmarks: [{ predicted: shifted, truth }],
      pixelsMm: pixels,
      landmarksMm: landmarks,
    })
    expect(moved.gpeMm).toBeCloseTo(3)
    expect(moved.gleMm).toBeCloseTo(3)
    expect(moved.lleMm).toBeCloseTo(3)
  })

  it('не диагностирует', () => {
    const stub: PoseModel = {
      id: 'stub',
      domain: 'forearm-tus-rec',
      predictPair: () => ({
        fromFrame: 1,
        toFrame: 0,
        translationMm: [0, 0, 0],
        rotationRad: [0, 0, 0],
        confidence: null,
        source: 'pose-network',
      }),
    }
    const geometry = reconstructScan([plane, plane], stub)
    expect(geometry).not.toHaveProperty('differential')
    expect(geometry.trajectory[1].confidence).toBeNull()
  })
})
