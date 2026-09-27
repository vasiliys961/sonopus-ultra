import { describe, expect, it } from 'vitest'
import { runFreehandBenchmark } from '@/benchmark/freehand3d/run-benchmark'
import { dicomSlice } from '@/lib/volume-engine/adapters/DicomVolumeAdapter'
import { ultrasoundSlice } from '@/lib/volume-engine/adapters/UltrasoundVolumeAdapter'
import { reconstructFreehand, type FreehandFrame } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { toVolumeEvidence, volumeEvidenceNote } from '@/lib/volume-engine/evidence/UltrasoundVolumeEvidenceAdapter'
import { exportVolumeJson } from '@/lib/volume-engine/export/VolumeExport'
import { LearnedPoseProvider } from '@/lib/volume-engine/pose/LearnedPoseProvider'
import type { PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { ReferencePoseProvider, referenceStep } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { SensorPoseProvider } from '@/lib/volume-engine/pose/SensorPoseProvider'
import { createPoseProvider } from '@/lib/volume-engine/pose/PoseRouter'
import { fillBridgedGaps } from '@/lib/volume-engine/reconstruction/GapAnalyzer'
import { reconstructSlices } from '@/lib/volume-engine/reconstruction/VolumeReconstructor'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import { gapFrames, shiftedPair, singleBrightFrame, slabFrames, sphereFrames } from '@/lib/volume-engine/phantom/shapes'
import { orthogonalSlice } from '@/lib/volume-engine/rendering/SliceRenderer'
import { renderVolumeWithTrajectory } from '@/lib/volume-engine/rendering/VolumeRenderer'
import { inspectDrift } from '@/lib/volume-engine/qc/PoseQC'
import { inspectVolume } from '@/lib/volume-engine/qc/VolumeQC'
import { physicalMeasuresAllowed } from '@/lib/volume-engine/types/VolumeTypes'
import { dofToMatrix } from '@/lib/spatial-reconstruction/rigid'
import { IDENTITY } from '@/lib/spatial-reconstruction/rigid'

function lowConfidence(): PoseProvider {
  return {
    id: 'low',
    mode: 'registration',
    async estimate() {
      return { translationMm: [1, 0, 0], rotationRad: [0, 0, 0], confidence: 0.05 }
    },
  }
}

function jump(): PoseProvider {
  return {
    id: 'jump',
    mode: 'registration',
    async estimate() {
      return { translationMm: [80, 0, 0], rotationRad: [0, 0, 0], confidence: 1 }
    },
  }
}

function rotatedFrame(): FreehandFrame {
  const size = 5
  const image = new Float32Array(size * size)
  const fieldMask = new Uint8Array(size * size)
  const index = 2 * size + 4
  image[index] = 1
  fieldMask[index] = 1
  return {
    frameId: 'rotated',
    timestamp: 0,
    image,
    width: size,
    height: size,
    pixelSpacingX: 1,
    pixelSpacingY: 1,
    fieldMask,
    transform: dofToMatrix([0, 0, 0], [0, 0, Math.PI / 2]),
    confidence: 1,
  }
}

describe('volume engine', () => {
  it('одинаковые кадры и позы дают одинаковый объём', async () => {
    const first = await reconstructFreehand(gapFrames(), new ReferencePoseProvider([]))
    const second = await reconstructFreehand(gapFrames(), new ReferencePoseProvider([]))
    expect(Array.from(first.volume.scalars)).toEqual(Array.from(second.volume.scalars))
    expect(Array.from(first.volume.observed)).toEqual(Array.from(second.volume.observed))
  })

  it('известный перенос сдвигает объём, известный поворот кладёт плоскость на другую ось', async () => {
    const moved = await reconstructFreehand(
      [singleBrightFrame(0), singleBrightFrame(5)],
      new ReferencePoseProvider([]),
    )
    const xs: number[] = []
    const [sx, sy] = moved.volume.size
    for (let iz = 0; iz < moved.volume.size[2]; iz += 1) {
      for (let iy = 0; iy < sy; iy += 1) {
        for (let ix = 0; ix < sx; ix += 1) {
          if (moved.volume.observed[voxelIndex(moved.volume.size, ix, iy, iz)] !== 1) continue
          xs.push(moved.volume.originMm[0] + ix * moved.volume.spacingMm[0])
        }
      }
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4)

    const turned = await reconstructFreehand([rotatedFrame()], new ReferencePoseProvider([]))
    let bestX = 0
    let bestY = 0
    let bestScalar = -1
    for (let iz = 0; iz < turned.volume.size[2]; iz += 1) {
      for (let iy = 0; iy < turned.volume.size[1]; iy += 1) {
        for (let ix = 0; ix < turned.volume.size[0]; ix += 1) {
          const cell = voxelIndex(turned.volume.size, ix, iy, iz)
          if ((turned.volume.scalars[cell] ?? 0) <= bestScalar) continue
          bestScalar = turned.volume.scalars[cell] ?? 0
          bestX = turned.volume.originMm[0] + ix * turned.volume.spacingMm[0]
          bestY = turned.volume.originMm[1] + iy * turned.volume.spacingMm[1]
        }
      }
    }
    expect(bestY).toBeGreaterThan(1)
    expect(Math.abs(bestX)).toBeLessThan(0.6)
  })

  it('без позы объём недоступен, низкая уверенность отбрасывает кадр, пробел остаётся неизвестным', async () => {
    const missing = await reconstructFreehand(shiftedPair(2), new ReferencePoseProvider([]))
    expect(missing.error).toBe('POSE_MODEL_UNAVAILABLE')
    expect(missing.volume.size).toEqual([0, 0, 0])

    const rejected = await reconstructFreehand(shiftedPair(2), lowConfidence())
    expect(rejected.rejectedFrames).toBe(1)
    expect(rejected.acceptedFrames).toBe(1)
    expect(rejected.findings.some((finding) => finding.code === 'POSE_LOW_CONFIDENCE')).toBe(true)

    const gap = await reconstructFreehand(gapFrames(), new ReferencePoseProvider([]))
    expect(gap.volume.interpolated.every((bit) => bit === 0)).toBe(true)
    expect(gap.volume.size[2]).toBeGreaterThan(2)
    expect(gap.volume.observed.some((bit) => bit === 0)).toBe(true)
    expect(gap.volume.clinicallyValidated).toBe(false)
  })

  it('экспериментальный объём нельзя измерять, даже если флаг конфигурации включён', async () => {
    const result = await reconstructFreehand(shiftedPair(2), new RegistrationPoseProvider(), {
      ...DEFAULT_FREEHAND_CONFIG,
      poseProvider: 'registration',
      enablePhysicalMeasurements: true,
    })
    expect(result.volume.status).toBe('experimental_estimated')
    expect(result.volume.poseMode).toBe('registration')
    expect(result.measuresAllowed).toBe(false)
    expect(physicalMeasuresAllowed(result.volume)).toBe(false)
    expect(volumeEvidenceNote(toVolumeEvidence(result))).toMatch(/EXPERIMENTAL RECONSTRUCTION/)
    expect(exportVolumeJson(result.volume)).not.toMatch(/lesion|14\.2/)
  })

  it('эталонный фантом помечается как тест и режется по трём осям', async () => {
    const result = await reconstructFreehand(slabFrames(), new ReferencePoseProvider([]))
    expect(result.volume.status).toBe('validated_reference')
    expect(physicalMeasuresAllowed(result.volume)).toBe(true)
    expect(result.volume.clinicallyValidated).toBe(false)
    const view = renderVolumeWithTrajectory(result.volume, result.trajectory)
    expect(view.axial.rgba.some((value) => value > 0)).toBe(true)
    expect(view.coronal.width).toBeGreaterThan(0)
    expect(view.sagittal.width).toBeGreaterThan(0)
    expect(view.trajectory.length).toBe(5)
    const sphere = await reconstructFreehand(sphereFrames(), new ReferencePoseProvider([]))
    expect(sphere.volume.observed.some((bit) => bit === 1)).toBe(true)
    expect(sphere.volume.interpolated.every((bit) => bit === 0)).toBe(true)
  })

  it('регистрация повторяет известный сдвиг, TUS-REC без checkpoint не строит позу', async () => {
    const registration = await reconstructFreehand(shiftedPair(2), new RegistrationPoseProvider(), {
      ...DEFAULT_FREEHAND_CONFIG,
      poseProvider: 'registration',
    })
    expect(registration.trajectory[1]?.matrix[3]).toBeCloseTo(2, 0)
    expect(registration.trajectory[1]?.matrix).not.toEqual(IDENTITY)

    const tus = await reconstructFreehand(
      shiftedPair(2),
      createPoseProvider({ ...DEFAULT_FREEHAND_CONFIG, poseProvider: 'learned', learnedModel: 'tus-rec-2024' }),
    )
    expect(tus.error).toBe('POSE_MODEL_UNAVAILABLE')
    expect(tus.volume.status).toBe('unavailable')

    const learned = await reconstructFreehand(
      shiftedPair(1),
      new LearnedPoseProvider('custom', { runPair: () => [0, 0, 4, 0, 0, 0] }),
    )
    expect(learned.trajectory[1]?.matrix[11]).toBeCloseTo(4)
    expect(learned.volume.poseMode).toBe('learned')
    expect(physicalMeasuresAllowed(learned.volume)).toBe(false)
  })

  it('скачок позы, дыра покрытия и слишком большая сетка называются своими кодами', async () => {
    const jumped = await reconstructFreehand(shiftedPair(1), jump())
    expect(jumped.findings.some((finding) => finding.code === 'POSE_JUMP')).toBe(true)
    expect(jumped.rejectedFrames).toBe(1)
    expect(inspectDrift(40, { maxStepMm: 40, maxRotationRad: 1, minConfidence: 0.35, maxUncertaintyMm: 25 })?.code).toBe('RECONSTRUCTION_UNSTABLE')

    const gap = await reconstructFreehand(gapFrames(), new ReferencePoseProvider([]))
    expect(inspectVolume(gap.volume, 0.9).some((finding) => finding.code === 'INSUFFICIENT_COVERAGE')).toBe(true)

    const dense = gapFrames().map((frame) => ({ ...frame, fieldMask: undefined, image: Float32Array.from({ length: 16 }, () => 1), width: 4, height: 4 }))
    const tooBig = await reconstructFreehand(dense, new ReferencePoseProvider([]), {
      ...DEFAULT_FREEHAND_CONFIG,
      voxelSizeMm: 0.05,
      maxVoxels: 30,
    })
    expect(tooBig.error).toBe('VOLUME_TOO_LARGE')
  })

  it('DICOM-срез получает позу из геометрии, а ультразвук без шкалы не становится срезом', () => {
    const slice = dicomSlice({
      frameId: 'ct-1',
      modality: 'CT',
      imagePositionPatient: [0, 0, 5],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
      rows: 1,
      columns: 1,
      pixels: Float32Array.from([0.4]),
    })
    const volume = reconstructSlices([slice], DEFAULT_FREEHAND_CONFIG, 'reference_test', 'dicom-ct').volume
    expect(volume.source).toBe('dicom-ct')
    expect(volume.originMm[2]).toBeCloseTo(5)
    expect(orthogonalSlice(volume, 'z', 0).rgba.some((value) => value > 0)).toBe(true)
    expect(ultrasoundSlice({
      frameId: 'us',
      timestamp: 0,
      image: Float32Array.from([1]),
      width: 1,
      height: 1,
      transform: IDENTITY,
      confidence: 1,
      calibration: null,
    })).toBeNull()
  })

  it('интерполяция заполняет только мостик между увиденными вокселями', () => {
    const size: [number, number, number] = [3, 1, 1]
    const scalars = Float32Array.from([1, 0, 1])
    const observed = Uint8Array.from([1, 0, 1])
    const interpolated = new Uint8Array(3)
    fillBridgedGaps(size, scalars, observed, interpolated)
    expect(observed[1]).toBe(0)
    expect(interpolated[1]).toBe(1)
    expect(scalars[1]).toBeCloseTo(1)
    expect(interpolated[0]).toBe(0)
  })

  it('без датчика поза не выдумывается, а бенчмарк сравнивает провайдеры на одних кадрах', async () => {
    const sensor = await reconstructFreehand(shiftedPair(1), new SensorPoseProvider(null))
    expect(sensor.error).toBe('POSE_MODEL_UNAVAILABLE')
    const rows = await runFreehandBenchmark()
    const reference = rows.filter((row) => row.provider === 'reference')
    const registration = rows.filter((row) => row.provider === 'registration')
    expect(reference).toHaveLength(10)
    expect(registration).toHaveLength(10)
    expect(reference.every((row) => row.translationMaeMm === 0)).toBe(true)
    expect(registration.every((row) => row.translationMaeMm != null && row.translationMaeMm < 0.6)).toBe(true)
    expect(rows.find((row) => row.provider === 'tus-rec')?.unavailable).toBe(true)
    expect(rows.find((row) => row.provider === 'custom')?.unavailable).toBe(true)
    expect(rows.every((row) => row.clinicallyValidated === false)).toBe(true)
  })

  it('эталонная поза без скрипта не подменяет собой регистрацию', async () => {
    const scripted = await reconstructFreehand(
      shiftedPair(3),
      new ReferencePoseProvider([referenceStep([3, 0, 0])]),
    )
    expect(scripted.volume.poseMode).toBe('reference_test')
    expect(scripted.trajectory[1]?.matrix[3]).toBeCloseTo(3)
    expect(scripted.measuresAllowed).toBe(true)
  })
})
