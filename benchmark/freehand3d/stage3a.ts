import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'
import { estimateVolumeBytes } from '@/lib/volume-engine/core/VolumeBuilder'
import { reconstructFreehand } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { ReferencePoseProvider } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider, DEFAULT_REGISTRATION } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'
import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import { degradeFrames, dropFrames, type NoiseLevel } from '@/benchmark/freehand3d/phantoms/degrade'
import {
  boundsErrorMm,
  centroidErrorMm,
  diameterError,
  dimensionErrorPercent,
  lengthError,
  measurePose,
  phantomSurface,
  separationErrorMm,
  surfaceDistances,
  volumeErrorPercent,
  type MetricValue,
  type PoseErrorReport,
} from '@/benchmark/freehand3d/phantoms/metrics'
import { cylinderPhantom, curvedTubePhantom, parallelCylindersPhantom, spherePhantom } from '@/benchmark/freehand3d/phantoms/shapes'
import {
  SyntheticSweepGenerator,
  trimBlankEdges,
  withPoseBias,
  withoutTransform,
  type SweepKind,
} from '@/benchmark/freehand3d/phantoms/sweep'
import type { Phantom } from '@/benchmark/freehand3d/phantoms/types'
import { differenceVolume, rasterPhantom } from '@/benchmark/freehand3d/phantoms/visualize'

const FRAMES = 20
const IMAGE = 32

export interface CaseMetrics {
  phantom: Phantom['id']
  sweep: SweepKind
  generatedFrames: number
  frames: number
  blankEdgesRemoved: number
  poseMode: 'perfect' | 'registration'
  noise: NoiseLevel
  dropoutPercent: number
  injectedTranslationMm: number
  injectedRotationDeg: number
  poseErrorMm: MetricValue
  centroidErrorMm: MetricValue
  boundsErrorMm: MetricValue
  volumeErrorPercent: MetricValue
  dimensionErrorPercent: MetricValue
  diameterErrorMm: MetricValue
  diameterErrorPercent: MetricValue
  lengthErrorMm: MetricValue
  lengthErrorPercent: MetricValue
  separationErrorMm: MetricValue
  surfaceMeanDistanceMm: MetricValue
  surfaceP95DistanceMm: MetricValue
  hausdorffDistanceMm: MetricValue
  coverage: MetricValue
  observedVoxels: number
  gridVoxels: number
  translationErrorXMm: MetricValue
  translationErrorYMm: MetricValue
  translationErrorZMm: MetricValue
  totalTranslationErrorMm: MetricValue
  rotation: MetricValue
  rotationMeaning: 'injected-ground-truth' | 'registration' | 'not-measured'
  rejectedFrames: number
  rejectionCodes: string[]
  error: string | null
  wallTimeMs: number
  memoryBytes: MetricValue
  poseMs: number
  samplingMs: number
  allocationMs: number
  splattingMs: number
  reconstructionMs: number
}

export interface Stage3AReport {
  stage: '3A'
  status: 'EXPERIMENTAL'
  clinicallyValidated: false
  tusRec: 'NOT CONNECTED'
  phantom: 'sphere'
  frames: number
  poseMode: 'perfect'
  poseErrorMm: number
  surfaceMeanDistanceMm: MetricValue
  dimensionErrorPercent: MetricValue
  volumeErrorPercent: MetricValue
  coverage: MetricValue
  image: {
    width: number
    height: number
    pixelSpacingMm: number
    stride: number
    kernelRadius: number
    note: string
  }
  perfectPose: CaseMetrics
  registration: CaseMetrics
  sensitivity: CaseMetrics[]
  rotationSensitivity: CaseMetrics[]
  rotationEnabledRegistration: CaseMetrics
  matrix: CaseMetrics[]
  sweeps: CaseMetrics[]
  phantoms: CaseMetrics[]
  performance: CaseMetrics[]
  questions: { q1: string; q2: string; q3: string }
}

interface CaseRequest {
  phantom: Phantom
  kind: SweepKind
  frames: number
  mode: 'perfect' | 'registration'
  noise?: NoiseLevel
  dropoutPercent?: number
  translationBiasMm?: Vec3
  rotationBiasRad?: Vec3
  enableRotation?: boolean
  measurePoseError?: boolean
}

interface Evaluation {
  metrics: CaseMetrics
  volume: ReconstructedVolume
}

const generator = new SyntheticSweepGenerator()

function injectedPose(translationMm: Vec3, rotationRad: Vec3): PoseErrorReport {
  const rotationDeg = Math.hypot(rotationRad[0], rotationRad[1], rotationRad[2]) * (180 / Math.PI)
  return {
    translationErrorXMm: Math.abs(translationMm[0]),
    translationErrorYMm: Math.abs(translationMm[1]),
    translationErrorZMm: Math.abs(translationMm[2]),
    totalTranslationErrorMm: Math.hypot(translationMm[0], translationMm[1], translationMm[2]),
    rotation: rotationDeg,
    knownSteps: 0,
    unknownSteps: 0,
    rejectedSteps: 0,
  }
}

function registrationProvider(enableRotation: boolean): RegistrationPoseProvider {
  if (!enableRotation) return new RegistrationPoseProvider()
  return new RegistrationPoseProvider({ ...DEFAULT_REGISTRATION, enableRotation: true })
}

export async function evaluateCase(request: CaseRequest, surfaces: Map<string, Vec3[]>): Promise<Evaluation> {
  const bias = request.translationBiasMm ?? [0, 0, 0]
  const tilt = request.rotationBiasRad ?? [0, 0, 0]
  let frames = generator.generate({
    phantom: request.phantom,
    kind: request.kind,
    frames: request.frames,
    width: IMAGE,
    height: IMAGE,
    pixelSpacingX: 1,
    pixelSpacingY: 1,
  })
  frames = degradeFrames(frames, request.noise ?? 'none')
  frames = dropFrames(frames, request.dropoutPercent ?? 0)
  frames = withPoseBias(frames, bias, tilt)
  const prepared = frames.length
  frames = trimBlankEdges(frames)
  const blankEdgesRemoved = prepared - frames.length
  const provider = request.mode === 'perfect' ? new ReferencePoseProvider([]) : registrationProvider(request.enableRotation === true)
  const started = performance.now()
  const built = await reconstructFreehand(
    request.mode === 'perfect' ? frames : withoutTransform(frames),
    provider,
    { ...DEFAULT_FREEHAND_CONFIG, poseProvider: request.mode === 'perfect' ? 'reference' : 'registration' },
  )
  const wallTimeMs = performance.now() - started
  const pose = request.mode === 'perfect'
    ? injectedPose(bias, tilt)
    : request.measurePoseError === false
      ? {
        translationErrorXMm: 'NOT ESTIMATED' as const,
        translationErrorYMm: 'NOT ESTIMATED' as const,
        translationErrorZMm: 'NOT ESTIMATED' as const,
        totalTranslationErrorMm: 'NOT ESTIMATED' as const,
        rotation: 'NOT ESTIMATED' as const,
        knownSteps: 0,
        unknownSteps: 0,
        rejectedSteps: 0,
      }
      : await measurePose(frames, registrationProvider(request.enableRotation === true))
  let surface = surfaces.get(request.phantom.id)
  if (!surface) {
    surface = phantomSurface(request.phantom, 1)
    surfaces.set(request.phantom.id, surface)
  }
  const distances = built.volume.observed.length === 0 ? null : surfaceDistances(surface, built.volume)
  const diameter = diameterError(built.volume, request.phantom)
  const length = lengthError(built.volume, request.phantom)
  const cells = built.volume.size[0] * built.volume.size[1] * built.volume.size[2]
  let observedVoxels = 0
  for (const bit of built.volume.observed) if (bit === 1) observedVoxels += 1
  const poseErrorMm: MetricValue = request.mode === 'perfect'
    ? Math.hypot(bias[0], bias[1], bias[2])
    : pose.totalTranslationErrorMm
  return {
    volume: built.volume,
    metrics: {
      phantom: request.phantom.id,
      sweep: request.kind,
      generatedFrames: request.frames,
      frames: frames.length,
      blankEdgesRemoved,
      poseMode: request.mode,
      noise: request.noise ?? 'none',
      dropoutPercent: request.dropoutPercent ?? 0,
      injectedTranslationMm: Math.hypot(bias[0], bias[1], bias[2]),
      injectedRotationDeg: Math.hypot(tilt[0], tilt[1], tilt[2]) * (180 / Math.PI),
      poseErrorMm,
      centroidErrorMm: centroidErrorMm(built.volume, request.phantom),
      boundsErrorMm: boundsErrorMm(built.volume, request.phantom),
      volumeErrorPercent: volumeErrorPercent(built.volume, request.phantom),
      dimensionErrorPercent: dimensionErrorPercent(built.volume, request.phantom),
      diameterErrorMm: diameter.absoluteMm,
      diameterErrorPercent: diameter.percent,
      lengthErrorMm: length.absoluteMm,
      lengthErrorPercent: length.percent,
      separationErrorMm: separationErrorMm(built.volume, request.phantom),
      surfaceMeanDistanceMm: distances ? distances.meanMm : 'NOT AVAILABLE',
      surfaceP95DistanceMm: distances ? distances.p95Mm : 'NOT AVAILABLE',
      hausdorffDistanceMm: distances ? distances.hausdorffMm : 'NOT AVAILABLE',
      coverage: built.volume.observed.length === 0 ? 'NOT AVAILABLE' : coverageRatio(built.volume.observed),
      observedVoxels,
      gridVoxels: cells,
      translationErrorXMm: pose.translationErrorXMm,
      translationErrorYMm: pose.translationErrorYMm,
      translationErrorZMm: pose.translationErrorZMm,
      totalTranslationErrorMm: pose.totalTranslationErrorMm,
      rotation: pose.rotation,
      rotationMeaning: request.mode === 'perfect' ? 'injected-ground-truth' : request.measurePoseError === false ? 'not-measured' : 'registration',
      rejectedFrames: built.rejectedFrames,
      rejectionCodes: [...new Set(built.findings.map((finding) => finding.code))],
      error: built.error,
      wallTimeMs,
      memoryBytes: cells === 0 ? 'NOT AVAILABLE' : estimateVolumeBytes(cells),
      poseMs: built.telemetry.poseMs,
      samplingMs: built.telemetry.samplingMs,
      allocationMs: built.telemetry.allocationMs,
      splattingMs: built.telemetry.splattingMs,
      reconstructionMs: built.telemetry.samplingMs + built.telemetry.allocationMs + built.telemetry.splattingMs,
    },
  }
}

function cell(value: MetricValue): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : String(value)
}

function questionText(perfect: CaseMetrics, registration: CaseMetrics, sensitivity: CaseMetrics[]): Stage3AReport['questions'] {
  const curve = sensitivity.map((row) => `${row.injectedTranslationMm} мм → поверхность ${cell(row.surfaceMeanDistanceMm)} мм, размер ${cell(row.dimensionErrorPercent)}%, объём ${cell(row.volumeErrorPercent)}%`).join('; ')
  return {
    q1: `Точная поза, сфера, проход по Z, ${perfect.frames} кадров: поверхность ${cell(perfect.surfaceMeanDistanceMm)} мм, размер ${cell(perfect.dimensionErrorPercent)}%, объём ${cell(perfect.volumeErrorPercent)}%, центроид ${cell(perfect.centroidErrorMm)} мм, покрытие сетки ${cell(perfect.coverage)}.`,
    q2: `Та же сфера через регистрацию: перенос X ${cell(registration.translationErrorXMm)} мм, Y ${cell(registration.translationErrorYMm)} мм, Z ${cell(registration.translationErrorZMm)}, поворот ${cell(registration.rotation)}. Поверхность ${cell(registration.surfaceMeanDistanceMm)} мм против ${cell(perfect.surfaceMeanDistanceMm)} мм, размер ${cell(registration.dimensionErrorPercent)}% против ${cell(perfect.dimensionErrorPercent)}%, Хаусдорф ${cell(registration.hausdorffDistanceMm)} мм против ${cell(perfect.hausdorffDistanceMm)} мм.`,
    q3: `Сдвиг эталонной позы по Z: ${curve}.`,
  }
}

export async function runStage3A(): Promise<Stage3AReport> {
  const sphere = spherePhantom()
  const surfaces = new Map<string, Vec3[]>()
  const perfect = await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'perfect' }, surfaces)
  const registration = await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'registration' }, surfaces)
  const sweeps: CaseMetrics[] = []
  for (const kind of ['linear-x', 'linear-y', 'linear-z', 'diagonal', 'curved', 'translated-rotated'] as const) {
    const row = kind === 'linear-z' ? perfect : await evaluateCase({ phantom: sphere, kind, frames: FRAMES, mode: 'perfect' }, surfaces)
    sweeps.push(row.metrics)
    if (kind === 'linear-x') sweeps.push((await evaluateCase({ phantom: sphere, kind, frames: FRAMES, mode: 'registration' }, surfaces)).metrics)
    if (kind === 'linear-z') sweeps.push(registration.metrics)
  }
  const phantoms = [
    perfect.metrics,
    (await evaluateCase({ phantom: cylinderPhantom(), kind: 'linear-z', frames: FRAMES, mode: 'perfect' }, surfaces)).metrics,
    (await evaluateCase({ phantom: parallelCylindersPhantom(), kind: 'linear-z', frames: FRAMES, mode: 'perfect' }, surfaces)).metrics,
    (await evaluateCase({ phantom: curvedTubePhantom(), kind: 'linear-z', frames: FRAMES, mode: 'perfect' }, surfaces)).metrics,
  ]
  const sensitivity: CaseMetrics[] = []
  for (const millimeters of [0, 0.5, 1, 2, 5, 10]) {
    const row = millimeters === 0
      ? perfect
      : await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'perfect', translationBiasMm: [0, 0, millimeters] }, surfaces)
    sensitivity.push(row.metrics)
  }
  const rotationSensitivity: CaseMetrics[] = []
  for (const degrees of [0, 2, 5, 10, 15, 20]) {
    const row = degrees === 0
      ? perfect
      : await evaluateCase({
        phantom: sphere,
        kind: 'linear-z',
        frames: FRAMES,
        mode: 'perfect',
        rotationBiasRad: [(degrees * Math.PI) / 180, 0, 0],
      }, surfaces)
    rotationSensitivity.push(row.metrics)
  }
  const rotationEnabledRegistration = await evaluateCase({
    phantom: sphere,
    kind: 'translated-rotated',
    frames: FRAMES,
    mode: 'registration',
    enableRotation: true,
  }, surfaces)
  const matrix: CaseMetrics[] = [
    perfect.metrics,
    (await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'perfect', noise: 'medium' }, surfaces)).metrics,
    registration.metrics,
    (await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'registration', noise: 'medium' }, surfaces)).metrics,
    (await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'registration', noise: 'medium', dropoutPercent: 10 }, surfaces)).metrics,
    (await evaluateCase({ phantom: sphere, kind: 'linear-z', frames: FRAMES, mode: 'registration', noise: 'high', dropoutPercent: 20 }, surfaces)).metrics,
  ]
  const performance: CaseMetrics[] = []
  for (const frames of [20, 50, 100, 200]) {
    for (const mode of ['perfect', 'registration'] as const) {
      performance.push((await evaluateCase({
        phantom: sphere,
        kind: 'linear-z',
        frames,
        mode,
        measurePoseError: false,
      }, surfaces)).metrics)
    }
  }
  const questions = questionText(perfect.metrics, registration.metrics, sensitivity)
  return {
    stage: '3A',
    status: 'EXPERIMENTAL',
    clinicallyValidated: false,
    tusRec: 'NOT CONNECTED',
    phantom: 'sphere',
    frames: perfect.metrics.frames,
    poseMode: 'perfect',
    poseErrorMm: 0,
    surfaceMeanDistanceMm: perfect.metrics.surfaceMeanDistanceMm,
    dimensionErrorPercent: perfect.metrics.dimensionErrorPercent,
    volumeErrorPercent: perfect.metrics.volumeErrorPercent,
    coverage: perfect.metrics.coverage,
    image: {
      width: IMAGE,
      height: IMAGE,
      pixelSpacingMm: 1,
      stride: 1,
      kernelRadius: 1,
      note: 'Синтетический кадр 32×32, проход 20 мм через центр фантома. Крайние кадры без эха или со слабым сечением (меньше четверти пика) снимаются до сборки, иначе регистрация якорится на пустом кадре. Это не плотный сплат клинического кадра 480×360.',
    },
    perfectPose: perfect.metrics,
    registration: registration.metrics,
    sensitivity,
    rotationSensitivity,
    rotationEnabledRegistration: rotationEnabledRegistration.metrics,
    matrix,
    sweeps,
    phantoms,
    performance,
    questions,
  }
}

export interface Stage3APreview {
  phantom: 'sphere'
  frames: number
  perfect: CaseMetrics
  registration: CaseMetrics
  sensitivity: CaseMetrics[]
  groundTruth: ReconstructedVolume
  perfectVolume: ReconstructedVolume
  registrationVolume: ReconstructedVolume
  difference: ReconstructedVolume
}

export async function loadStage3APreview(): Promise<Stage3APreview> {
  const phantom = spherePhantom()
  const surfaces = new Map<string, Vec3[]>()
  const perfect = await evaluateCase({ phantom, kind: 'linear-z', frames: FRAMES, mode: 'perfect' }, surfaces)
  const registration = await evaluateCase({ phantom, kind: 'linear-z', frames: FRAMES, mode: 'registration' }, surfaces)
  const sensitivity: CaseMetrics[] = [perfect.metrics]
  for (const millimeters of [0.5, 1, 2, 5, 10]) {
    sensitivity.push((await evaluateCase({
      phantom,
      kind: 'linear-z',
      frames: FRAMES,
      mode: 'perfect',
      translationBiasMm: [0, 0, millimeters],
    }, surfaces)).metrics)
  }
  return {
    phantom: 'sphere',
    frames: perfect.metrics.frames,
    perfect: perfect.metrics,
    registration: registration.metrics,
    sensitivity,
    groundTruth: rasterPhantom(phantom, perfect.volume),
    perfectVolume: perfect.volume,
    registrationVolume: registration.volume,
    difference: differenceVolume(phantom, perfect.volume, registration.volume),
  }
}
