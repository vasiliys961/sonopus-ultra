import { dofToMatrix, multiplyMat4, transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { FreehandFrame } from '@/lib/volume-engine/core/VolumeEngine'
import type { Phantom } from '@/benchmark/freehand3d/phantoms/types'

export type SweepKind = 'linear-x' | 'linear-y' | 'linear-z' | 'diagonal' | 'curved' | 'translated-rotated'

export interface SweepFrame extends FreehandFrame {
  groundTruthTransform: Mat4
}

export interface SweepRequest {
  phantom: Phantom
  kind: SweepKind
  frames: number
  width?: number
  height?: number
  pixelSpacingX?: number
  pixelSpacingY?: number
  /** Длина прохода в миллиметрах. Начало и конец симметричны относительно центра фантома. */
  spanMm?: number
}

const SPAN_MM = 20

function offset(kind: SweepKind, t: number, span: number): { translation: Vec3; rotation: Vec3 } {
  const delta = (t - 0.5) * span
  if (kind === 'linear-x') return { translation: [delta, 0, 0], rotation: [0, 0, 0] }
  if (kind === 'linear-y') return { translation: [0, delta, 0], rotation: [0, 0, 0] }
  if (kind === 'linear-z') return { translation: [0, 0, delta], rotation: [0, 0, 0] }
  if (kind === 'diagonal') return { translation: [delta, delta * 0.5, 0], rotation: [0, 0, 0] }
  if (kind === 'curved') {
    const angle = (t - 0.5) * (Math.PI / 3)
    return { translation: [span * 0.5 * Math.sin(angle), 0, span * 0.5 * (1 - Math.cos(angle))], rotation: [0, angle, 0] }
  }
  return { translation: [delta, 0, 0], rotation: [0, 0, (t - 0.5) * 0.35] }
}

export function groundTruthPose(phantom: Phantom, kind: SweepKind, index: number, frames: number, spanMm = SPAN_MM): Mat4 {
  const t = frames <= 1 ? 0.5 : index / (frames - 1)
  const motion = offset(kind, t, spanMm)
  const center = phantom.truth.centroid
  return dofToMatrix([
    center[0] + motion.translation[0],
    center[1] + motion.translation[1],
    center[2] + motion.translation[2],
  ], motion.rotation)
}

export function renderSweepFrame(phantom: Phantom, transform: Mat4, index: number, width: number, height: number, pixelSpacingX: number, pixelSpacingY: number): SweepFrame {
  const image = new Float32Array(width * height)
  const fieldMask = new Uint8Array(width * height)
  for (let v = 0; v < height; v += 1) {
    for (let u = 0; u < width; u += 1) {
      const local: Vec3 = [(u + 0.5 - width / 2) * pixelSpacingX, (v + 0.5 - height / 2) * pixelSpacingY, 0]
      if (!phantom.contains(transformPoint(transform, local))) continue
      const pixel = v * width + u
      image[pixel] = 1
      fieldMask[pixel] = 1
    }
  }
  return {
    frameId: `${phantom.id}-${index}`,
    timestamp: index,
    image,
    width,
    height,
    pixelSpacingX,
    pixelSpacingY,
    fieldMask,
    quality: 1,
    confidence: 1,
    transform,
    groundTruthTransform: transform,
  }
}

export function withPoseBias(frames: readonly SweepFrame[], translationMm: Vec3, rotationRad: Vec3 = [0, 0, 0]): SweepFrame[] {
  const extra = dofToMatrix([0, 0, 0], rotationRad)
  return frames.map((frame) => {
    const rotated = multiplyMat4(frame.groundTruthTransform, extra)
    const transform: Mat4 = [
      rotated[0], rotated[1], rotated[2], rotated[3] + translationMm[0],
      rotated[4], rotated[5], rotated[6], rotated[7] + translationMm[1],
      rotated[8], rotated[9], rotated[10], rotated[11] + translationMm[2],
      rotated[12], rotated[13], rotated[14], rotated[15],
    ]
    return { ...frame, transform }
  })
}

export function withoutTransform(frames: readonly SweepFrame[]): FreehandFrame[] {
  return frames.map((frame) => ({
    frameId: frame.frameId,
    timestamp: frame.timestamp,
    image: frame.image,
    width: frame.width,
    height: frame.height,
    pixelSpacingX: frame.pixelSpacingX,
    pixelSpacingY: frame.pixelSpacingY,
    quality: frame.quality,
    fieldMask: frame.fieldMask,
    confidence: frame.confidence,
  }))
}

export class SyntheticSweepGenerator {
  generate(request: SweepRequest): SweepFrame[] {
    const width = request.width ?? 32
    const height = request.height ?? 32
    const pixelSpacingX = request.pixelSpacingX ?? 1
    const pixelSpacingY = request.pixelSpacingY ?? 1
    const frames: SweepFrame[] = []
    for (let index = 0; index < request.frames; index += 1) {
      const transform = groundTruthPose(request.phantom, request.kind, index, request.frames, request.spanMm ?? SPAN_MM)
      frames.push(renderSweepFrame(request.phantom, transform, index, width, height, pixelSpacingX, pixelSpacingY))
    }
    return frames
  }
}
