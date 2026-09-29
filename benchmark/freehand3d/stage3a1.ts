import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'
import { estimateVolumeBytes } from '@/lib/volume-engine/core/VolumeBuilder'
import { reconstructFreehand } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG, type Freehand3DConfig } from '@/lib/volume-engine/config/Freehand3DConfig'
import { ReferencePoseProvider } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { centroidErrorMm, type MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'
import { degradeFrames, dropFrames, type NoiseLevel } from '@/benchmark/freehand3d/phantoms/degrade'
import {
  centerlineDistance,
  comparisonGrid,
  countOccupied,
  declaredMeasurements,
  differenceVolume,
  discreteSurfaceDistance,
  projectReconstruction,
  volumeErrorVsAnalyticTruthPercent,
  volumeErrorVsVoxelTruthPercent,
  voxelizePhantom,
  type CenterlineError,
  type DeclaredMeasurement,
  type DiscreteSurfaceDistance,
} from '@/benchmark/freehand3d/phantoms/groundTruth'
import {
  collectRegistrationPoses,
  perfectPoseTrajectory,
  registrationTrajectory,
  type PoseTrajectoryReport,
} from '@/benchmark/freehand3d/phantoms/poseTrajectory'
import { cylinderPhantom, curvedTubePhantom, parallelCylindersPhantom, spherePhantom } from '@/benchmark/freehand3d/phantoms/shapes'
import {
  SyntheticSweepGenerator,
  trimBlankEdges,
  withPoseBias,
  withoutTransform,
  type SweepFrame,
  type SweepKind,
} from '@/benchmark/freehand3d/phantoms/sweep'
import type { Phantom } from '@/benchmark/freehand3d/phantoms/types'

const generator = new SyntheticSweepGenerator()

export interface ReconstructionRecord {
  phantom: Phantom['id']
  sweep: SweepKind
  dataset: 'raw' | 'trimmed'
  poseMode: 'perfect' | 'registration'
  imageCondition: NoiseLevel
  poseCondition: 'ground-truth' | 'injected-bias' | 'registration'
  injectedTranslationMm: number
  injectedRotationDeg: number
  rotationAxis: 'none' | 'X' | 'Y' | 'Z'
  generatedFrames: number
  inputFrames: number
  usedFrames: number
  trimmedFrames: number
  droppedFrames: number
  width: number
  height: number
  voxelSpacingMm: number
  stride: 1 | 2 | 4
  kernelRadius: number
  gridSize: [number, number, number]
  voxelOccupied: number
  dice: MetricValue
  iou: MetricValue
  falsePositive: number
  falseNegative: number
  discreteSurface: DiscreteSurfaceDistance
  volumeErrorVsVoxelTruthPercent: MetricValue
  volumeErrorVsAnalyticTruthPercent: MetricValue
  voxelizationDiscrepancyPercent: MetricValue
  centroidErrorMm: MetricValue
  measurements: DeclaredMeasurement[]
  centerline: CenterlineError
  pose: PoseTrajectoryReport
  rejectedFrames: number
  error: string | null
  estimatedMemoryBytes: MetricValue
  runtimeMemoryBytes: MetricValue
  poseMs: number | 'BELOW_1_MS'
  samplingMs: number | 'BELOW_1_MS'
  allocationMs: number | 'BELOW_1_MS'
  splattingMs: number | 'BELOW_1_MS'
  reconstructionMs: number | 'BELOW_1_MS'
  totalMs: number
  coverage: MetricValue
}

export interface Stage3A1Report {
  stage: '3A.1'
  status: 'EXPERIMENTAL'
  clinicallyValidated: false
  tusRec: 'NOT CONNECTED'
  baselines: {
    voxelTruth: {
      phantom: 'sphere'
      occupiedVoxels: number
      analyticVolumeMm3: number
      voxelVolumeMm3: number
      volumeDiscrepancyPercent: MetricValue
    }
    perfectPose: ReconstructionRecord
    estimatedPose: ReconstructionRecord
  }
  pose: ReconstructionRecord['pose']
  reconstruction: {
    surface: DiscreteSurfaceDistance
    volume: {
      versusVoxelTruthPercent: MetricValue
      versusAnalyticTruthPercent: MetricValue
    }
    dice: MetricValue
    iou: MetricValue
  }
  accuracy: ReconstructionRecord[]
  robustness: {
    noise: ReconstructionRecord[]
    dropout: ReconstructionRecord[]
    poseBias: ReconstructionRecord[]
    rotation: ReconstructionRecord[]
    trimmed: ReconstructionRecord
  }
  performance: ReconstructionRecord[]
  questions: { q1: string; q2: string; q3: string; q4: string; q5: string }
  limitations: string[]
}

interface RunRequest {
  phantom: Phantom
  kind: SweepKind
  frames: number
  mode: 'perfect' | 'registration'
  dataset?: 'raw' | 'trimmed'
  noise?: NoiseLevel
  dropoutPercent?: number
  translationBiasMm?: Vec3
  rotationBiasRad?: Vec3
  rotationAxis?: 'none' | 'X' | 'Y' | 'Z'
  width?: number
  height?: number
  spacingMm?: number
  stride?: 1 | 2 | 4
  kernelRadius?: number
}

function stageMs(value: number): number | 'BELOW_1_MS' {
  return value > 0 ? value : 'BELOW_1_MS'
}

function heapUsed(): number | null {
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') return null
  return process.memoryUsage().heapUsed
}

function configFor(request: RunRequest): Freehand3DConfig {
  const spacing = request.spacingMm ?? 1
  return {
    ...DEFAULT_FREEHAND_CONFIG,
    poseProvider: request.mode === 'perfect' ? 'reference' : 'registration',
    voxelSizeMm: spacing,
    voxelSize: [spacing, spacing, spacing],
    pixelStride: request.stride ?? 1,
    kernelRadius: request.kernelRadius ?? 1,
  }
}

export async function evaluateReconstruction(request: RunRequest): Promise<{ record: ReconstructionRecord; truth: ReconstructedVolume; projected: ReconstructedVolume; volume: ReconstructedVolume }> {
  const spacing = request.spacingMm ?? 1
  const width = request.width ?? 32
  const height = request.height ?? 32
  const bias = request.translationBiasMm ?? [0, 0, 0]
  const tilt = request.rotationBiasRad ?? [0, 0, 0]
  const generated = generator.generate({
    phantom: request.phantom,
    kind: request.kind,
    frames: request.frames,
    width,
    height,
    pixelSpacingX: 1,
    pixelSpacingY: 1,
  })
  const degraded = degradeFrames(generated, request.noise ?? 'none')
  const afterDropout = dropFrames(degraded, request.dropoutPercent ?? 0)
  const biased = withPoseBias(afterDropout, bias, tilt)
  const trimmed = trimBlankEdges(biased)
  const dataset = request.dataset ?? 'raw'
  const used = dataset === 'trimmed' ? trimmed : biased
  const truth = voxelizePhantom(request.phantom, comparisonGrid(request.phantom, spacing))
  const config = configFor(request)
  const provider = request.mode === 'perfect' ? new ReferencePoseProvider([]) : new RegistrationPoseProvider()
  const engineFrames = request.mode === 'perfect' ? used : withoutTransform(used)
  const beforeHeap = heapUsed()
  const started = performance.now()
  const built = await reconstructFreehand(engineFrames, provider, config)
  const totalMs = performance.now() - started
  const afterHeap = heapUsed()
  const projected = projectReconstruction(built.volume, truth)
  const overlapTruth = truth.observed
  const overlapReconstruction = projected.observed
  let truePositive = 0
  let falsePositive = 0
  let falseNegative = 0
  for (let index = 0; index < overlapTruth.length; index += 1) {
    const expected = overlapTruth[index] === 1
    const actual = overlapReconstruction[index] === 1
    if (expected && actual) truePositive += 1
    else if (actual) falsePositive += 1
    else if (expected) falseNegative += 1
  }
  const diceDenom = 2 * truePositive + falsePositive + falseNegative
  const iouDenom = truePositive + falsePositive + falseNegative
  const occupied = countOccupied(overlapReconstruction)
  const voxelOccupied = countOccupied(overlapTruth)
  const pose = request.mode === 'perfect'
    ? perfectPoseTrajectory(used)
    : registrationTrajectory(used, (await collectRegistrationPoses(used, new RegistrationPoseProvider(), config)).accepted)
  const cells = built.volume.size[0] * built.volume.size[1] * built.volume.size[2]
  const injectedTranslation = Math.hypot(bias[0], bias[1], bias[2])
  const injectedRotation = Math.hypot(tilt[0], tilt[1], tilt[2]) * (180 / Math.PI)
  return {
    truth,
    projected,
    volume: built.volume,
    record: {
      phantom: request.phantom.id,
      sweep: request.kind,
      dataset,
      poseMode: request.mode,
      imageCondition: request.noise ?? 'none',
      poseCondition: request.mode === 'registration' ? 'registration' : injectedTranslation > 0 || injectedRotation > 0 ? 'injected-bias' : 'ground-truth',
      injectedTranslationMm: injectedTranslation,
      injectedRotationDeg: injectedRotation,
      rotationAxis: request.rotationAxis ?? 'none',
      generatedFrames: generated.length,
      inputFrames: afterDropout.length,
      usedFrames: used.length,
      trimmedFrames: trimmed.length,
      droppedFrames: generated.length - afterDropout.length,
      width,
      height,
      voxelSpacingMm: spacing,
      stride: request.stride ?? 1,
      kernelRadius: request.kernelRadius ?? 1,
      gridSize: truth.size,
      voxelOccupied,
      dice: diceDenom === 0 ? 'NOT AVAILABLE' : (2 * truePositive) / diceDenom,
      iou: iouDenom === 0 ? 'NOT AVAILABLE' : truePositive / iouDenom,
      falsePositive,
      falseNegative,
      discreteSurface: discreteSurfaceDistance(truth, projected),
      volumeErrorVsVoxelTruthPercent: volumeErrorVsVoxelTruthPercent(overlapReconstruction, overlapTruth),
      volumeErrorVsAnalyticTruthPercent: volumeErrorVsAnalyticTruthPercent(occupied, spacing, request.phantom.truth.volumeMm3),
      voxelizationDiscrepancyPercent: volumeErrorVsAnalyticTruthPercent(voxelOccupied, spacing, request.phantom.truth.volumeMm3),
      centroidErrorMm: centroidErrorMm(projected, request.phantom),
      measurements: declaredMeasurements(request.phantom, projected),
      centerline: centerlineDistance(request.phantom, projected),
      pose,
      rejectedFrames: built.rejectedFrames,
      error: built.error,
      estimatedMemoryBytes: cells === 0 ? 'NOT AVAILABLE' : estimateVolumeBytes(cells),
      runtimeMemoryBytes: beforeHeap == null || afterHeap == null ? 'NOT AVAILABLE' : afterHeap - beforeHeap,
      poseMs: stageMs(built.telemetry.poseMs),
      samplingMs: stageMs(built.telemetry.samplingMs),
      allocationMs: stageMs(built.telemetry.allocationMs),
      splattingMs: stageMs(built.telemetry.splattingMs),
      reconstructionMs: stageMs(built.telemetry.samplingMs + built.telemetry.allocationMs + built.telemetry.splattingMs),
      totalMs,
      coverage: built.volume.observed.length === 0 ? 'NOT AVAILABLE' : coverageRatio(built.volume.observed),
    },
  }
}

function cell(value: MetricValue): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : String(value)
}

function surfaceMean(record: ReconstructionRecord): MetricValue {
  return record.discreteSurface.reconstructionToGroundTruth.meanMm
}

export async function runStage3A1(): Promise<Stage3A1Report> {
  const sphere = spherePhantom()
  const base = { phantom: sphere, kind: 'linear-z' as const, frames: 20, width: 32, height: 32, spacingMm: 1, stride: 1 as const, kernelRadius: 1, dataset: 'raw' as const }
  const perfect = await evaluateReconstruction({ ...base, mode: 'perfect' })
  const estimated = await evaluateReconstruction({ ...base, mode: 'registration' })
  const accuracy: ReconstructionRecord[] = [perfect.record, estimated.record]
  for (const phantom of [cylinderPhantom(), parallelCylindersPhantom(), curvedTubePhantom()]) {
    accuracy.push((await evaluateReconstruction({ ...base, phantom, mode: 'perfect' })).record)
    accuracy.push((await evaluateReconstruction({ ...base, phantom, mode: 'registration' })).record)
  }
  for (const kind of ['linear-x', 'linear-y', 'diagonal', 'curved', 'translated-rotated'] as const) {
    accuracy.push((await evaluateReconstruction({ ...base, kind, mode: 'perfect' })).record)
  }
  accuracy.push((await evaluateReconstruction({ ...base, kind: 'linear-x', mode: 'registration' })).record)
  for (const spacingMm of [0.5, 2]) {
    accuracy.push((await evaluateReconstruction({ ...base, spacingMm, mode: 'perfect' })).record)
  }
  const noise: ReconstructionRecord[] = []
  for (const imageCondition of ['none', 'medium', 'high'] as const) {
    for (const mode of ['perfect', 'registration'] as const) {
      const row = imageCondition === 'none' && mode === 'perfect' ? perfect : imageCondition === 'none' && mode === 'registration' ? estimated : await evaluateReconstruction({ ...base, noise: imageCondition, mode })
      noise.push(row.record)
    }
  }
  const dropout: ReconstructionRecord[] = []
  for (const dropoutPercent of [0, 5, 10, 20, 30]) {
    dropout.push((await evaluateReconstruction({ ...base, kind: 'linear-x', mode: 'registration', dropoutPercent })).record)
  }
  const poseBias: ReconstructionRecord[] = []
  for (const millimeters of [0, 0.5, 1, 2, 5, 10]) {
    const row = millimeters === 0 ? perfect : await evaluateReconstruction({ ...base, mode: 'perfect', translationBiasMm: [0, 0, millimeters] })
    poseBias.push(row.record)
  }
  const rotation: ReconstructionRecord[] = []
  for (const axis of ['X', 'Y', 'Z'] as const) {
    for (const degrees of [0, 2, 5, 10, 15, 20]) {
      const rotationBiasRad: Vec3 = axis === 'X' ? [(degrees * Math.PI) / 180, 0, 0] : axis === 'Y' ? [0, (degrees * Math.PI) / 180, 0] : [0, 0, (degrees * Math.PI) / 180]
      const row = await evaluateReconstruction({ ...base, frames: 12, mode: 'perfect', rotationBiasRad, rotationAxis: axis })
      rotation.push(row.record)
    }
  }
  const trimmed = await evaluateReconstruction({ ...base, mode: 'registration', dataset: 'trimmed' })
  const performance: ReconstructionRecord[] = []
  for (const frames of [20, 50, 100, 200]) {
    performance.push((await evaluateReconstruction({ ...base, kind: 'linear-x', frames, mode: 'perfect' })).record)
    performance.push((await evaluateReconstruction({ ...base, kind: 'linear-x', frames, mode: 'registration' })).record)
  }
  for (const width of [32, 64, 128]) {
    performance.push((await evaluateReconstruction({ ...base, frames: 12, width, height: width, mode: 'perfect' })).record)
  }
  performance.push((await evaluateReconstruction({ ...base, frames: 12, width: 480, height: 360, stride: 4, mode: 'perfect' })).record)
  for (const stride of [1, 2, 4] as const) {
    performance.push((await evaluateReconstruction({ ...base, frames: 12, stride, mode: 'perfect' })).record)
  }
  for (const kernelRadius of [0, 1, 2]) {
    performance.push((await evaluateReconstruction({ ...base, frames: 12, kernelRadius, mode: 'perfect' })).record)
  }
  const perfectRecord = perfect.record
  const estimatedRecord = estimated.record
  const trimmedRecord = trimmed.record
  const linearXRegistration = accuracy.find((row) => row.phantom === 'sphere' && row.sweep === 'linear-x' && row.poseMode === 'registration')
  const questions = {
    q1: `Точная поза, сфера, RAW, ${perfectRecord.usedFrames} кадров: Dice ${cell(perfectRecord.dice)}, IoU ${cell(perfectRecord.iou)}, discrete surface reconstruction→GT ${cell(surfaceMean(perfectRecord))} мм, объём против voxel truth ${cell(perfectRecord.volumeErrorVsVoxelTruthPercent)}%, против аналитического объёма ${cell(perfectRecord.volumeErrorVsAnalyticTruthPercent)}%. Расхождение voxel truth и аналитического объёма ${cell(perfectRecord.voxelizationDiscrepancyPercent)}%.`,
    q2: `RAW-регистрация тех же кадров: Dice ${cell(estimatedRecord.dice)}, IoU ${cell(estimatedRecord.iou)}, discrete surface reconstruction→GT ${cell(surfaceMean(estimatedRecord))} мм, отклонено ${estimatedRecord.rejectedFrames}, ошибка ${estimatedRecord.error ?? 'нет'}. TRIMMED, кадров ${trimmedRecord.usedFrames}: Dice ${cell(trimmedRecord.dice)}, IoU ${cell(trimmedRecord.iou)}, surface ${cell(surfaceMean(trimmedRecord))} мм. RAW linear-x: Dice ${cell(linearXRegistration?.dice ?? 'NOT AVAILABLE')}, IoU ${cell(linearXRegistration?.iou ?? 'NOT AVAILABLE')}, surface ${cell(linearXRegistration ? surfaceMean(linearXRegistration) : 'NOT AVAILABLE')} мм.`,
    q3: `RAW linear-z: drift известных осей ${cell(estimatedRecord.pose.drift.knownAxesTranslationMm)} мм, placement ${cell(estimatedRecord.pose.drift.placementTranslationMm)} мм, Z ${cell(estimatedRecord.pose.global.translationZMm)}, поворот ${cell(estimatedRecord.pose.drift.rotationDeg)}. TRIMMED linear-z: known-axis drift ${cell(trimmedRecord.pose.drift.knownAxesTranslationMm)} мм, placement drift ${cell(trimmedRecord.pose.drift.placementTranslationMm)} мм, поворот ${cell(trimmedRecord.pose.drift.rotationDeg)}. RAW linear-x: local ${cell(linearXRegistration?.pose.local.meanTranslationMm ?? 'NOT AVAILABLE')} мм, global mean ${cell(linearXRegistration?.pose.global.meanTranslationMm ?? 'NOT AVAILABLE')} мм, drift ${cell(linearXRegistration?.pose.drift.knownAxesTranslationMm ?? 'NOT AVAILABLE')} мм, поворот ${cell(linearXRegistration?.pose.drift.rotationDeg ?? 'NOT AVAILABLE')}.`,
    q4: `Сдвиг переданной позы 10 мм: Dice ${cell(poseBias[5]?.dice ?? 'NOT AVAILABLE')}, surface ${cell(poseBias[5] ? surfaceMean(poseBias[5]) : 'NOT AVAILABLE')} мм. Dropout 30% на проходе X: Dice ${cell(dropout[4]?.dice ?? 'NOT AVAILABLE')}. Шум high, регистрация: Dice ${cell(noise[5]?.dice ?? 'NOT AVAILABLE')}.`,
    q5: `20 кадров 32×32 проход X: точная поза ${cell(performance[0]?.totalMs ?? 'NOT AVAILABLE')} мс, регистрация ${cell(performance[1]?.totalMs ?? 'NOT AVAILABLE')} мс. 200 кадров: точная поза ${cell(performance[6]?.totalMs ?? 'NOT AVAILABLE')} мс, регистрация ${cell(performance[7]?.totalMs ?? 'NOT AVAILABLE')} мс. Память в отчёте — estimatedMemoryBytes сетки.`,
  }
  return {
    stage: '3A.1',
    status: 'EXPERIMENTAL',
    clinicallyValidated: false,
    tusRec: 'NOT CONNECTED',
    baselines: {
      voxelTruth: {
        phantom: 'sphere',
        occupiedVoxels: perfectRecord.voxelOccupied,
        analyticVolumeMm3: sphere.truth.volumeMm3,
        voxelVolumeMm3: perfectRecord.voxelOccupied * perfectRecord.voxelSpacingMm ** 3,
        volumeDiscrepancyPercent: perfectRecord.voxelizationDiscrepancyPercent,
      },
      perfectPose: perfectRecord,
      estimatedPose: estimatedRecord,
    },
    pose: estimatedRecord.pose,
    reconstruction: {
      surface: perfectRecord.discreteSurface,
      volume: {
        versusVoxelTruthPercent: perfectRecord.volumeErrorVsVoxelTruthPercent,
        versusAnalyticTruthPercent: perfectRecord.volumeErrorVsAnalyticTruthPercent,
      },
      dice: perfectRecord.dice,
      iou: perfectRecord.iou,
    },
    accuracy,
    robustness: { noise, dropout, poseBias, rotation, trimmed: trimmed.record },
    performance,
    questions,
    limitations: [
      'Stage 3A.1 — контролируемый синтетический benchmark. Это не клиническая валидация.',
      'discrete_surface_distance считается по центрам вокселей сетки фантома. Это не клиническая точность поверхности.',
      'Аналитический объём и voxel truth — разные представления. Оба показаны отдельно.',
      'Основной benchmark RAW не выбрасывает крайние кадры. TRIMMED записан отдельно.',
      'Неизвестные оси позы не заменяются нулём. placementTranslationMm показывает геометрию матрицы, в которую неизвестная ось записана как 0.',
      'Таймер движка имеет шаг 1 мс. Компонент короче одного тика записан как BELOW_1_MS.',
      'estimatedMemoryBytes — оценка сетки. runtimeMemoryBytes — разница heap и не является RSS.',
      'TUS-REC не подключён. Кадры синтетические.',
    ],
  }
}

export interface Stage3A1Preview {
  perfect: ReconstructionRecord
  registration: ReconstructionRecord
  voxelOccupied: number
  analyticDiscrepancyPercent: MetricValue
  truth: ReconstructedVolume
  perfectVolume: ReconstructedVolume
  registrationVolume: ReconstructedVolume
  difference: ReconstructedVolume
  poseBias: ReconstructionRecord[]
  dropout: ReconstructionRecord[]
  noise: ReconstructionRecord[]
  spacing: ReconstructionRecord[]
  stride: ReconstructionRecord[]
}

export async function loadStage3A1Preview(): Promise<Stage3A1Preview> {
  const phantom = spherePhantom()
  const base = { phantom, kind: 'linear-z' as const, frames: 12, width: 32, height: 32, spacingMm: 1, stride: 1 as const, kernelRadius: 1, dataset: 'raw' as const }
  const perfect = await evaluateReconstruction({ ...base, mode: 'perfect' })
  const registration = await evaluateReconstruction({ ...base, mode: 'registration' })
  const poseBias = [perfect.record]
  for (const millimeters of [1, 5, 10]) {
    poseBias.push((await evaluateReconstruction({ ...base, mode: 'perfect', translationBiasMm: [0, 0, millimeters] })).record)
  }
  const dropout = []
  for (const dropoutPercent of [0, 10, 30]) {
    dropout.push((await evaluateReconstruction({ ...base, kind: 'linear-x', mode: 'perfect', dropoutPercent })).record)
  }
  const noise = []
  for (const imageCondition of ['none', 'medium', 'high'] as const) {
    noise.push((await evaluateReconstruction({ ...base, mode: 'perfect', noise: imageCondition })).record)
  }
  const spacing = [perfect.record]
  spacing.push((await evaluateReconstruction({ ...base, spacingMm: 2, mode: 'perfect' })).record)
  const stride = [perfect.record]
  stride.push((await evaluateReconstruction({ ...base, stride: 4, mode: 'perfect' })).record)
  return {
    perfect: perfect.record,
    registration: registration.record,
    voxelOccupied: perfect.record.voxelOccupied,
    analyticDiscrepancyPercent: perfect.record.voxelizationDiscrepancyPercent,
    truth: perfect.truth,
    perfectVolume: perfect.volume,
    registrationVolume: registration.volume,
    difference: differenceVolume(perfect.truth, registration.projected),
    poseBias,
    dropout,
    noise,
    spacing,
    stride,
  }
}
