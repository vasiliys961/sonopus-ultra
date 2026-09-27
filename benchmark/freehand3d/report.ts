import { runFreehandBenchmark } from '@/benchmark/freehand3d/run-benchmark'
import { reconstructFreehand } from '@/lib/volume-engine/core/VolumeEngine'
import { DEFAULT_FREEHAND_CONFIG } from '@/lib/volume-engine/config/Freehand3DConfig'
import { estimateVolumeBytes } from '@/lib/volume-engine/core/VolumeBuilder'
import { IDENTITY } from '@/lib/spatial-reconstruction/rigid'
import { ReferencePoseProvider } from '@/lib/volume-engine/pose/ReferencePoseProvider'
import { RegistrationPoseProvider } from '@/lib/volume-engine/pose/RegistrationPoseProvider'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'
import type { FreehandFrame } from '@/lib/volume-engine/core/VolumeEngine'

export interface Stage2Report {
  frames: number
  poseProvider: 'registration'
  translationMaeMm: number
  rotationMaeDeg: null
  coverage: number
  rejectedFrames: number
  reconstructionTimeMs: number
  memoryBytes: number
  outOfPlane: 'not-estimated'
  clinicallyValidated: false
  timings: Array<{ frames: number; width: number; height: number; stride: number; ms: number; voxels: number }>
}

function maskedFrames(count: number, width: number, height: number, posed: boolean): FreehandFrame[] {
  const frames: FreehandFrame[] = []
  for (let index = 0; index < count; index += 1) {
    const image = new Float32Array(width * height)
    const fieldMask = new Uint8Array(width * height)
    const cx = Math.floor(width / 2)
    const cy = Math.floor(height / 2)
    for (let y = cy - 8; y < cy + 8; y += 1) {
      for (let x = cx - 8; x < cx + 8; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        const pixel = y * width + x
        fieldMask[pixel] = 1
        image[pixel] = 0.8
      }
    }
    frames.push({
      frameId: `perf-${index}`,
      timestamp: index,
      image,
      width,
      height,
      pixelSpacingX: 0.2,
      pixelSpacingY: 0.2,
      fieldMask,
      confidence: 1,
      transform: posed ? IDENTITY : undefined,
    })
  }
  return frames
}

export async function collectStage2Report(): Promise<Stage2Report> {
  const rows = await runFreehandBenchmark()
  const registration = rows.filter((row) => row.provider === 'registration' && row.translationMaeMm != null)
  const translationMaeMm = registration.reduce((sum, row) => sum + (row.translationMaeMm ?? 0), 0) / registration.length
  const pair = maskedFrames(2, 64, 48, false)
  const started = Date.now()
  const sample = await reconstructFreehand(pair, new RegistrationPoseProvider(), {
    ...DEFAULT_FREEHAND_CONFIG,
    poseProvider: 'registration',
    pixelStride: 2,
  })
  const reconstructionTimeMs = Date.now() - started
  const timings: Stage2Report['timings'] = []
  const cases: Array<[number, number, number, 1 | 2 | 4]> = [
    [20, 320, 240, 2],
    [50, 320, 240, 2],
    [100, 320, 240, 2],
    [20, 480, 360, 4],
    [20, 640, 480, 4],
    [100, 480, 360, 4],
    [200, 320, 240, 2],
  ]
  for (const [count, width, height, stride] of cases) {
    const frames = maskedFrames(count, width, height, true)
    const mark = Date.now()
    const built = await reconstructFreehand(frames, new ReferencePoseProvider([]), {
      ...DEFAULT_FREEHAND_CONFIG,
      pixelStride: stride,
      kernelRadius: 1,
    })
    timings.push({
      frames: count,
      width,
      height,
      stride,
      ms: Date.now() - mark,
      voxels: built.volume.size[0] * built.volume.size[1] * built.volume.size[2],
    })
  }
  const hundred = timings.find((row) => row.frames === 100 && row.width === 480)
  return {
    frames: 100,
    poseProvider: 'registration',
    translationMaeMm,
    rotationMaeDeg: null,
    coverage: coverageRatio(sample.volume.observed),
    rejectedFrames: sample.rejectedFrames,
    reconstructionTimeMs: hundred?.ms ?? reconstructionTimeMs,
    memoryBytes: estimateVolumeBytes(sample.volume.scalars.length),
    outOfPlane: 'not-estimated',
    clinicallyValidated: false,
    timings,
  }
}
