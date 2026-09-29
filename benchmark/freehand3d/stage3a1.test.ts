import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { reconstructFreehand } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { dofToMatrix, IDENTITY } from '@/lib/spatial-reconstruction/rigid'
import {
  centerlineDistance,
  comparisonGrid,
  componentSeparationMm,
  countOccupied,
  declaredMeasurements,
  differenceVolume,
  discreteSurfaceDistance,
  overlap,
  volumeErrorVsAnalyticTruthPercent,
  volumeErrorVsVoxelTruthPercent,
  voxelizePhantom,
} from '@/benchmark/freehand3d/phantoms/groundTruth'
import { collectRegistrationPoses, poseTrajectoryMetrics } from '@/benchmark/freehand3d/phantoms/poseTrajectory'
import { curvedTubePhantom, parallelCylindersPhantom, spherePhantom } from '@/benchmark/freehand3d/phantoms/shapes'
import { SyntheticSweepGenerator, withoutTransform } from '@/benchmark/freehand3d/phantoms/sweep'
import { stage3a1Markdown } from '@/benchmark/freehand3d/stage3a1-format'
import { evaluateReconstruction, runStage3A1, type Stage3A1Report } from '@/benchmark/freehand3d/stage3a1'

const reports = '/Users/maxmobiles.ru/Desktop/ultrasound-ultra/benchmark/freehand3d/reports'
const known = ['known', 'known', 'known'] as const
const unknown = ['unknown', 'unknown', 'unknown'] as const

function roundValue(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : value
  if (Array.isArray(value)) return value.map(roundValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundValue(item)]))
  }
  return value
}

function stable(record: { dice: unknown; iou: unknown; voxelOccupied: number; pose: { local: { meanTranslationMm: unknown }; drift: { knownAxesTranslationMm: unknown; rotationDeg: unknown } } }) {
  return {
    dice: record.dice,
    iou: record.iou,
    voxelOccupied: record.voxelOccupied,
    local: record.pose.local.meanTranslationMm,
    drift: record.pose.drift.knownAxesTranslationMm,
    rotation: record.pose.drift.rotationDeg,
  }
}

describe('stage 3A.1 ground truth', () => {
  it('вокселизует сферу на своей сетке и не путает её с аналитическим объёмом', () => {
    const sphere = spherePhantom()
    const grid = comparisonGrid(sphere, 1)
    const truth = voxelizePhantom(sphere, grid)
    const again = voxelizePhantom(sphere, comparisonGrid(sphere, 1))
    expect(countOccupied(truth.observed)).toBeGreaterThan(0)
    expect(countOccupied(truth.observed)).toBe(countOccupied(again.observed))
    expect(truth.originMm).toEqual(again.originMm)
    expect(overlap(truth.observed, truth.observed).dice).toBe(1)
    expect(overlap(truth.observed, truth.observed).iou).toBe(1)
    expect(volumeErrorVsVoxelTruthPercent(truth.observed, truth.observed)).toBe(0)
    const analytic = volumeErrorVsAnalyticTruthPercent(countOccupied(truth.observed), 1, sphere.truth.volumeMm3)
    expect(typeof analytic).toBe('number')
    expect(Math.abs(Number(analytic))).toBeGreaterThan(1)
    const surface = discreteSurfaceDistance(truth, truth)
    expect(surface.method).toBe('discrete_surface_distance')
    expect(surface.reconstructionToGroundTruth.meanMm).toBe(0)
    expect(surface.groundTruthToReconstruction.hausdorffMm).toBe(0)
    const same = differenceVolume(truth, truth)
    expect(same.scalars.some((value) => value === 0.25)).toBe(true)
    expect(same.scalars.some((value) => value === 1)).toBe(false)
  })

  it('разделяет параллельные цилиндры по компонентам и считает осевую линию трубки', () => {
    const parallel = parallelCylindersPhantom()
    const parallelTruth = voxelizePhantom(parallel, comparisonGrid(parallel, 1))
    const separation = componentSeparationMm(parallelTruth)
    expect(typeof separation).toBe('number')
    expect(Math.abs(Number(separation) - 12)).toBeLessThan(1.5)
    const diameter = declaredMeasurements(parallel, parallelTruth).find((item) => item.name === 'diameter')
    expect(diameter?.method).toBe('axis-extent')
    expect(diameter?.axis).toBe(1)
    const gap = declaredMeasurements(parallel, parallelTruth).find((item) => item.axis === 'components')
    expect(gap?.method).toBe('connected-components')

    const tube = curvedTubePhantom()
    const tubeTruth = voxelizePhantom(tube, comparisonGrid(tube, 1))
    const line = centerlineDistance(tube, tubeTruth)
    expect(typeof line.meanMm).toBe('number')
    expect(typeof line.maxMm).toBe('number')
    expect(Number(line.meanMm)).toBeLessThan(2)
    const arc = declaredMeasurements(tube, tubeTruth).find((item) => item.axis === 'arc')
    expect(arc?.method).toBe('arc-not-an-axis-extent')
    expect(arc?.measuredMm).toBe('NOT AVAILABLE')
  })
})

describe('stage 3A.1 pose', () => {
  it('отличает локальный шаг, накопленный сдвиг и неизвестный поворот', () => {
    const groundTruth = [0, 1, 2].map((step) => dofToMatrix([step, 0, 0], [0, 0, 0]))
    const identity = poseTrajectoryMetrics(groundTruth, groundTruth, known, known)
    expect(identity.local.meanTranslationMm).toBeCloseTo(0, 6)
    expect(identity.global.maxTranslationMm).toBeCloseTo(0, 6)
    expect(identity.drift.knownAxesTranslationMm).toBeCloseTo(0, 6)
    expect(identity.drift.rotationDeg).toBeCloseTo(0, 6)

    const biased = groundTruth.map((matrix) => {
      const copy = [...matrix]
      copy[11] += 5
      return copy as typeof matrix
    })
    const shift = poseTrajectoryMetrics(groundTruth, biased, known, known)
    expect(shift.local.meanTranslationMm).toBeCloseTo(0, 5)
    expect(shift.drift.knownAxesTranslationMm).toBeCloseTo(0, 5)
    expect(shift.global.meanTranslationMm).toBeCloseTo(0, 5)

    const lagging = [0, 1, 2].map((step) => dofToMatrix([step === 2 ? 1 : step, 0, 0], [0, 0, 0]))
    const drift = poseTrajectoryMetrics(groundTruth, lagging, known, known)
    expect(drift.drift.knownAxesTranslationMm).toBeCloseTo(1, 5)
    expect(drift.global.maxTranslationMm).toBeCloseTo(1, 5)
    expect(Number(drift.local.meanTranslationMm)).toBeLessThan(1)

    const tilted = [0, 1, 2].map((step) => dofToMatrix([step, 0, 0], [step === 0 ? 0 : (10 * Math.PI) / 180, 0, 0]))
    const turn = poseTrajectoryMetrics(groundTruth, tilted, known, known)
    expect(turn.drift.rotationDeg).toBeCloseTo(10, 1)
    expect(turn.global.maxRotationDeg).toBeCloseTo(10, 1)

    const hidden = poseTrajectoryMetrics(groundTruth, lagging, ['known', 'known', 'unknown'], unknown)
    expect(hidden.local.translationZMm).toBe('NOT ESTIMATED')
    expect(hidden.drift.rotationDeg).toBe('NOT ESTIMATED')
    expect(hidden.drift.rotationDeg).not.toBe(0)
    expect(hidden.global.translationZMm).toBe('NOT ESTIMATED')
  })

  it('не отдаёт ground truth регистрации и повторяет цепочку движка', async () => {
    const frames = new SyntheticSweepGenerator().generate({ phantom: spherePhantom(), kind: 'linear-x', frames: 8, width: 32, height: 32 })
    const visible = withoutTransform(frames)
    expect(visible[0]).not.toHaveProperty('groundTruthTransform')
    expect(visible[0]?.transform).toBeUndefined()
    expect(JSON.stringify(visible)).not.toContain('groundTruthTransform')

    const first = await collectRegistrationPoses(frames, new RegistrationPoseProvider())
    const corrupted = frames.map((frame) => ({ ...frame, groundTruthTransform: IDENTITY }))
    const second = await collectRegistrationPoses(corrupted, new RegistrationPoseProvider())
    expect(first.accepted.map((step) => step.matrix)).toEqual(second.accepted.map((step) => step.matrix))

    const built = await reconstructFreehand(visible, new RegistrationPoseProvider(), DEFAULT_FREEHAND_CONFIG)
    expect(first.accepted).toHaveLength(built.trajectory.length)
    first.accepted.forEach((step, index) => {
      expect(step.matrix[3]).toBeCloseTo(built.trajectory[index]?.matrix[3] ?? Number.NaN, 5)
      expect(step.matrix[11]).toBeCloseTo(built.trajectory[index]?.matrix[11] ?? Number.NaN, 5)
    })
  })
})

describe('stage 3A.1 reconstruction', () => {
  it('сравнивает точную позу с voxel truth и не подмешивает обрезку краёв', async () => {
    const sphere = spherePhantom()
    const perfect = await evaluateReconstruction({ phantom: sphere, kind: 'linear-z', frames: 8, mode: 'perfect' })
    const again = await evaluateReconstruction({ phantom: sphere, kind: 'linear-z', frames: 8, mode: 'perfect' })
    expect(stable(perfect.record)).toEqual(stable(again.record))
    expect(perfect.record.usedFrames).toBe(perfect.record.generatedFrames)
    expect(perfect.record.dataset).toBe('raw')
    expect(perfect.record.pose.drift.knownAxesTranslationMm).toBeCloseTo(0, 4)
    expect(perfect.record.pose.drift.rotationDeg).toBeCloseTo(0, 4)
    expect(typeof perfect.record.dice).toBe('number')
    expect(typeof perfect.record.volumeErrorVsVoxelTruthPercent).toBe('number')
    expect(typeof perfect.record.volumeErrorVsAnalyticTruthPercent).toBe('number')
    expect(perfect.record.volumeErrorVsVoxelTruthPercent).not.toBe(perfect.record.volumeErrorVsAnalyticTruthPercent)

    const biased = await evaluateReconstruction({ phantom: sphere, kind: 'linear-z', frames: 8, mode: 'perfect', translationBiasMm: [0, 0, 5] })
    expect(biased.record.injectedTranslationMm).toBeCloseTo(5, 5)
    expect(biased.record.poseCondition).toBe('injected-bias')
    expect(biased.record.pose.local.meanTranslationMm).toBeCloseTo(0, 4)
    expect(biased.record.pose.drift.knownAxesTranslationMm).toBeCloseTo(0, 4)
    expect(Number(biased.record.centroidErrorMm)).toBeGreaterThan(Number(perfect.record.centroidErrorMm) + 3)

    const registration = await evaluateReconstruction({ phantom: sphere, kind: 'linear-z', frames: 8, mode: 'registration' })
    expect(registration.record.pose.local.translationZMm).toBe('NOT ESTIMATED')
    expect(registration.record.pose.drift.rotationDeg).toBe('NOT ESTIMATED')
    expect(registration.record.pose.global.translationZMm).toBe('NOT ESTIMATED')
    expect(registration.record.imageCondition).toBe('none')
    expect(registration.record.poseCondition).toBe('registration')
  })
})

describe('stage 3A.1 report', () => {
  let report: Stage3A1Report

  beforeAll(async () => {
    report = await runStage3A1()
    mkdirSync(reports, { recursive: true })
    writeFileSync(path.join(reports, 'stage3a1.json'), `${JSON.stringify(roundValue(report), null, 2)}\n`)
    writeFileSync(path.join(reports, 'stage3a1.md'), stage3a1Markdown(report))
  }, 300000)

  it('держит три baseline, drift и числа без оценки качества', () => {
    expect(report.stage).toBe('3A.1')
    expect(report.status).toBe('EXPERIMENTAL')
    expect(report.clinicallyValidated).toBe(false)
    expect(report.tusRec).toBe('NOT CONNECTED')
    expect(report.baselines.voxelTruth.occupiedVoxels).toBeGreaterThan(0)
    expect(typeof report.baselines.perfectPose.dice).toBe('number')
    expect(typeof report.baselines.perfectPose.iou).toBe('number')
    expect(report.baselines.estimatedPose.pose.local.translationZMm).toBe('NOT ESTIMATED')
    expect(report.baselines.estimatedPose.pose.drift.rotationDeg).toBe('NOT ESTIMATED')
    expect(report.baselines.estimatedPose.usedFrames).toBe(report.baselines.estimatedPose.generatedFrames)
    expect(report.robustness.trimmed.dataset).toBe('trimmed')
    expect(report.robustness.trimmed.usedFrames).toBeLessThan(report.baselines.estimatedPose.usedFrames)
    expect(report.robustness.poseBias.map((row) => row.injectedTranslationMm)).toEqual([0, 0.5, 1, 2, 5, 10])
    expect(report.robustness.rotation.map((row) => row.rotationAxis)).toEqual([
      'X', 'X', 'X', 'X', 'X', 'X',
      'Y', 'Y', 'Y', 'Y', 'Y', 'Y',
      'Z', 'Z', 'Z', 'Z', 'Z', 'Z',
    ])
    expect(report.accuracy.some((row) => row.voxelSpacingMm === 0.5)).toBe(true)
    expect(report.accuracy.some((row) => row.voxelSpacingMm === 2)).toBe(true)
    expect(report.performance.some((row) => row.width === 480 && row.height === 360)).toBe(true)
    expect(report.performance.map((row) => row.kernelRadius)).toEqual(expect.arrayContaining([0, 1, 2]))
    expect(report.performance.map((row) => row.stride)).toEqual(expect.arrayContaining([1, 2, 4]))
    expect(report.questions.q1.length).toBeGreaterThan(20)
    expect(report.questions.q5).toContain('estimatedMemoryBytes')
    const text = JSON.stringify(report)
    expect(text).not.toMatch(/"GOOD"|"BAD"|"CLINICALLY ACCURATE"|"ACCEPTED"|"READY"/)
    expect(report.limitations[0]).toContain('не клиническая валидация')
  })
})
