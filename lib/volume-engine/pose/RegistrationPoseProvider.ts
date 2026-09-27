import type { FramePlane, PoseEstimate, PoseProvider } from '@/lib/volume-engine/pose/PoseProvider'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

export interface RegistrationConfig {
  searchRadiusPx: number
  pyramidLevels: number
  minConfidence: number
  maxTranslationMm: number
  enableRotation: boolean
  rotationSearchRangeDeg: number
  rotationStepDeg: number
}

export const DEFAULT_REGISTRATION: RegistrationConfig = {
  searchRadiusPx: 6,
  pyramidLevels: 2,
  minConfidence: 0.35,
  maxTranslationMm: 40,
  enableRotation: false,
  rotationSearchRangeDeg: 10,
  rotationStepDeg: 2,
}

interface GrayImage {
  gray: Float32Array
  width: number
  height: number
}

function downsample(image: GrayImage): GrayImage {
  const width = Math.max(1, Math.floor(image.width / 2))
  const height = Math.max(1, Math.floor(image.height / 2))
  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      let count = 0
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const sx = x * 2 + dx
          const sy = y * 2 + dy
          if (sx >= image.width || sy >= image.height) continue
          sum += image.gray[sy * image.width + sx] ?? 0
          count += 1
        }
      }
      gray[y * width + x] = count === 0 ? 0 : sum / count
    }
  }
  return { gray, width, height }
}

function correlate(left: GrayImage, right: GrayImage, dx: number, dy: number): number {
  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumA2 = 0
  let sumB2 = 0
  let count = 0
  const width = Math.min(left.width, right.width)
  const height = Math.min(left.height, right.height)
  for (let y = 0; y < height; y += 1) {
    const y2 = y + dy
    if (y2 < 0 || y2 >= right.height) continue
    for (let x = 0; x < width; x += 1) {
      const x2 = x + dx
      if (x2 < 0 || x2 >= right.width) continue
      const a = left.gray[y * left.width + x] ?? 0
      const b = right.gray[y2 * right.width + x2] ?? 0
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

function searchShift(left: GrayImage, right: GrayImage, guessX: number, guessY: number, radius: number): { dx: number; dy: number; score: number } {
  let best = -2
  let dx = guessX
  let dy = guessY
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const score = correlate(left, right, guessX + ox, guessY + oy)
      if (score > best) {
        best = score
        dx = guessX + ox
        dy = guessY + oy
      }
    }
  }
  return { dx, dy, score: best }
}

function rotate(image: GrayImage, radians: number): GrayImage {
  const gray = new Float32Array(image.width * image.height)
  const cx = (image.width - 1) / 2
  const cy = (image.height - 1) / 2
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const sx = Math.round(cos * dx + sin * dy + cx)
      const sy = Math.round(-sin * dx + cos * dy + cy)
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue
      gray[y * image.width + x] = image.gray[sy * image.width + sx] ?? 0
    }
  }
  return { gray, width: image.width, height: image.height }
}

/**
 * 2D_IN_PLANE_REGISTRATION.
 * Сдвиг рисунка в плоскости кадра. Вне плоскости и наклоны датчика не оцениваются:
 * tz остаётся 0 и помечен unknown, это не измеренный ноль.
 */
export class RegistrationPoseProvider implements PoseProvider {
  readonly id = 'registration-ncc'
  readonly mode = 'registration' as const

  constructor(private readonly config: RegistrationConfig = DEFAULT_REGISTRATION) {}

  async estimate(previous: FramePlane, current: FramePlane): Promise<PoseEstimate> {
    if (previous.pixelSpacingX == null || previous.pixelSpacingY == null || current.pixelSpacingX == null || current.pixelSpacingY == null) {
      throw new VolumeEngineError('CALIBRATION_MISSING', 'Для регистрации нужна шкала по обеим осям кадра.')
    }
    const levels = Math.max(1, Math.min(4, this.config.pyramidLevels))
    const left: GrayImage[] = [{ gray: previous.gray, width: previous.width, height: previous.height }]
    const right: GrayImage[] = [{ gray: current.gray, width: current.width, height: current.height }]
    for (let level = 1; level < levels; level += 1) {
      const previousLevel = left[level - 1]
      const currentLevel = right[level - 1]
      if (!previousLevel || !currentLevel || previousLevel.width < 8 || previousLevel.height < 8) break
      left.push(downsample(previousLevel))
      right.push(downsample(currentLevel))
    }
    let dx = 0
    let dy = 0
    let score = -2
    for (let level = left.length - 1; level >= 0; level -= 1) {
      dx *= 2
      dy *= 2
      const radius = level === left.length - 1 ? this.config.searchRadiusPx : 2
      const leftLevel = left[level]
      const rightLevel = right[level]
      if (!leftLevel || !rightLevel) continue
      const found = searchShift(leftLevel, rightLevel, dx, dy, radius)
      dx = found.dx
      dy = found.dy
      score = found.score
    }
    let rotationRad = 0
    let rotationKnown: 'known' | 'unknown' = 'unknown'
    if (this.config.enableRotation && this.config.rotationStepDeg > 0) {
      const step = this.config.rotationStepDeg * Math.PI / 180
      const range = this.config.rotationSearchRangeDeg * Math.PI / 180
      let bestScore = score
      const base = right[0]
      const source = left[0]
      if (base && source) {
        for (let angle = -range; angle <= range + 1e-9; angle += step) {
          const turned = rotate(base, -angle)
          const found = correlate(source, turned, dx, dy)
          if (found > bestScore) {
            bestScore = found
            rotationRad = angle
            score = found
            rotationKnown = 'known'
          }
        }
      }
    }
    const confidence = Math.max(0, Math.min(1, score))
    if (confidence < this.config.minConfidence) {
      return {
        translationMm: [0, 0, 0],
        rotationRad: [0, 0, 0],
        confidence,
        translationAxes: ['unknown', 'unknown', 'unknown'],
        rotationAxes: ['unknown', 'unknown', 'unknown'],
        method: '2d-in-plane',
      }
    }
    const tx = dx * previous.pixelSpacingX
    const ty = dy * previous.pixelSpacingY
    if (Math.hypot(tx, ty) > this.config.maxTranslationMm) {
      throw new VolumeEngineError('REGISTRATION_FAILED', 'Сдвиг в плоскости больше допустимого.')
    }
    return {
      translationMm: [tx, ty, 0],
      rotationRad: [0, 0, rotationRad],
      confidence: this.config.enableRotation ? confidence : Math.min(confidence, 0.85),
      translationAxes: ['known', 'known', 'unknown'],
      rotationAxes: ['unknown', 'unknown', rotationKnown],
      method: '2d-in-plane',
    }
  }
}
