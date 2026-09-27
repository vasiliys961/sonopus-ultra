import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { dropFrames } from '@/benchmark/freehand3d/phantoms/degrade'
import { measurePose } from '@/benchmark/freehand3d/phantoms/metrics'
import { cylinderPhantom, curvedTubePhantom, parallelCylindersPhantom, spherePhantom } from '@/benchmark/freehand3d/phantoms/shapes'
import { SyntheticSweepGenerator, withPoseBias } from '@/benchmark/freehand3d/phantoms/sweep'
import { runStage3A, type Stage3AReport } from '@/benchmark/freehand3d/stage3a'
import { stage3aMarkdown } from '@/benchmark/freehand3d/stage3a-format'

const reports = '/Users/maxmobiles.ru/Desktop/ultrasound-ultra/benchmark/freehand3d/reports'

function roundValue(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : value
  if (Array.isArray(value)) return value.map(roundValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundValue(item)]))
  }
  return value
}

describe('stage 3A phantoms', () => {
  it('хранит известную геометрию сферы, цилиндров и трубки', () => {
    const sphere = spherePhantom()
    expect(sphere.truth.diameterMm).toBe(12)
    expect(sphere.truth.centroid).toEqual([0, 0, 0])
    expect(sphere.contains([0, 0, 0])).toBe(true)
    expect(sphere.contains([0, 0, 6.1])).toBe(false)
    expect(sphere.truth.volumeMm3).toBeCloseTo((4 / 3) * Math.PI * 6 ** 3, 6)

    const cylinder = cylinderPhantom()
    expect(cylinder.truth.diameterMm).toBe(8)
    expect(cylinder.truth.lengthMm).toBe(16)
    expect(cylinder.contains([0, 0, 0])).toBe(true)
    expect(cylinder.contains([0, 0, 9])).toBe(false)

    const parallel = parallelCylindersPhantom()
    expect(parallel.truth.distanceBetweenStructuresMm).toBe(12)
    expect(parallel.contains([-6, 0, 0])).toBe(true)
    expect(parallel.contains([6, 0, 0])).toBe(true)
    expect(parallel.contains([0, 0, 0])).toBe(false)

    const tube = curvedTubePhantom()
    expect(tube.contains([10, 0, 0])).toBe(true)
    expect(tube.contains([0, 0, 0])).toBe(false)
    expect(tube.truth.lengthMm).toBeGreaterThan(10)
  })

  it('кладёт ground truth в каждый кадр и не берёт его из оценки', () => {
    const frames = new SyntheticSweepGenerator().generate({ phantom: spherePhantom(), kind: 'linear-x', frames: 20 })
    expect(frames).toHaveLength(20)
    expect(frames[0]?.groundTruthTransform).toEqual(frames[0]?.transform)
    const travel = (frames[19]?.groundTruthTransform[3] ?? 0) - (frames[0]?.groundTruthTransform[3] ?? 0)
    expect(travel).toBeCloseTo(20, 5)
    const shifted = withPoseBias(frames, [0, 0, 5])
    expect(shifted[0]?.groundTruthTransform).toEqual(frames[0]?.groundTruthTransform)
    expect(shifted[0]?.transform?.[11]).toBeCloseTo((frames[0]?.groundTruthTransform[11] ?? 0) + 5, 5)
    expect(dropFrames(frames, 10)).toHaveLength(18)
  })

  it('не записывает неизвестную ось Z как ноль', async () => {
    const frames = new SyntheticSweepGenerator().generate({ phantom: spherePhantom(), kind: 'linear-z', frames: 12 })
    const pose = await measurePose(frames)
    expect(pose.translationErrorZMm).toBe('NOT ESTIMATED')
    expect(pose.rotation).toBe('NOT ESTIMATED')
    expect(typeof pose.translationErrorXMm).toBe('number')
  })
})

describe('stage 3A report', () => {
  let report: Stage3AReport

  beforeAll(async () => {
    report = await runStage3A()
    mkdirSync(reports, { recursive: true })
    writeFileSync(path.join(reports, 'stage3a.json'), `${JSON.stringify(roundValue(report), null, 2)}\n`)
    writeFileSync(path.join(reports, 'stage3a.md'), stage3aMarkdown(report))
  }, 180000)

  it('сравнивает точную позу и регистрацию на одной сфере', () => {
    expect(report.stage).toBe('3A')
    expect(report.status).toBe('EXPERIMENTAL')
    expect(report.clinicallyValidated).toBe(false)
    expect(report.tusRec).toBe('NOT CONNECTED')
    expect(report.registration.translationErrorZMm).toBe('NOT ESTIMATED')
    expect(report.registration.rotation).toBe('NOT ESTIMATED')
    expect(report.registration.rotationMeaning).toBe('registration')
    expect(typeof report.perfectPose.surfaceMeanDistanceMm).toBe('number')
    expect(typeof report.perfectPose.dimensionErrorPercent).toBe('number')
    expect(typeof report.perfectPose.volumeErrorPercent).toBe('number')
    expect(typeof report.perfectPose.coverage).toBe('number')
    expect(report.perfectPose.centroidErrorMm).toBeLessThan(3)
    expect(report.registration.dimensionErrorPercent).toBeGreaterThan(Number(report.perfectPose.dimensionErrorPercent) + 10)
    expect(report.registration.hausdorffDistanceMm).toBeGreaterThan(Number(report.perfectPose.hausdorffDistanceMm) + 2)
    const far = report.sensitivity.find((row) => row.injectedTranslationMm === 10)
    const near = report.sensitivity.find((row) => row.injectedTranslationMm === 0)
    expect(far?.surfaceMeanDistanceMm).toBeGreaterThan(Number(near?.surfaceMeanDistanceMm) + 2)
    expect(report.sensitivity.map((row) => row.injectedTranslationMm)).toEqual([0, 0.5, 1, 2, 5, 10])
    expect(report.performance.map((row) => row.generatedFrames)).toEqual([20, 20, 50, 50, 100, 100, 200, 200])
    expect(report.phantoms.map((row) => row.phantom)).toEqual(['sphere', 'cylinder', 'parallel-cylinders', 'curved-tube'])
    const parallel = report.phantoms.find((row) => row.phantom === 'parallel-cylinders')
    expect(typeof parallel?.separationErrorMm).toBe('number')
    expect(parallel?.separationErrorMm).toBeLessThan(4)
  })
})
