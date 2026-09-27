import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

const GRID = 24
const SEARCH = 6

function resample(frame: FramePlane, size: number): Float32Array {
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(frame.width - 1, Math.floor(((x + 0.5) * frame.width) / size))
      const sy = Math.min(frame.height - 1, Math.floor(((y + 0.5) * frame.height) / size))
      out[y * size + x] = frame.gray[sy * frame.width + sx] ?? 0
    }
  }
  return out
}

function correlate(left: Float32Array, right: Float32Array, size: number, dx: number, dy: number): number {
  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumA2 = 0
  let sumB2 = 0
  let count = 0
  for (let y = 0; y < size; y += 1) {
    const y2 = y + dy
    if (y2 < 0 || y2 >= size) continue
    for (let x = 0; x < size; x += 1) {
      const x2 = x + dx
      if (x2 < 0 || x2 >= size) continue
      const a = left[y * size + x] ?? 0
      const b = right[y2 * size + x2] ?? 0
      sumA += a
      sumB += b
      sumAB += a * b
      sumA2 += a * a
      sumB2 += b * b
      count += 1
    }
  }
  if (count < 8) return -1
  const meanA = sumA / count
  const meanB = sumB / count
  const varA = sumA2 - count * meanA * meanA
  const varB = sumB2 - count * meanB * meanB
  if (varA <= 1e-8 || varB <= 1e-8) return 0
  return (sumAB - count * meanA * meanB) / Math.sqrt(varA * varB)
}

/**
 * Сдвиг яркой структуры в плоскости кадра.
 * Положительный tx — структура сместилась вправо на изображении.
 * Вне плоскости и поворот этот baseline не оценивает.
 */
export class RegistrationPoseProvider implements PoseProvider {
  readonly id = 'registration-ncc'
  readonly mode = 'registration' as const

  async estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate> {
    if (previous.pixelSpacingX == null || previous.pixelSpacingY == null || current.pixelSpacingX == null || current.pixelSpacingY == null) {
      throw new VolumeEngineError('CALIBRATION_MISSING', 'Для регистрации нужна шкала по обеим осям кадра.')
    }
    const size = Math.min(GRID, previous.width, previous.height, current.width, current.height)
    const left = resample(previous, size)
    const right = resample(current, size)
    let best = -2
    let bestDx = 0
    let bestDy = 0
    const radius = Math.min(SEARCH, Math.floor(size / 3))
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const score = correlate(left, right, size, dx, dy)
        if (score > best) {
          best = score
          bestDx = dx
          bestDy = dy
        }
      }
    }
    const scaleX = previous.width / size
    const scaleY = previous.height / size
    return {
      translationMm: [bestDx * scaleX * previous.pixelSpacingX, bestDy * scaleY * previous.pixelSpacingY, 0],
      rotationRad: [0, 0, 0],
      confidence: Math.max(0, Math.min(1, best)),
    }
  }
}
