import { invertMat4 } from '@/lib/sono-3d/inverse'
import { multiplyMat4, translationOf } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import { VolumeEngineError } from '@/lib/volume-engine/errors'

const BOTTOM_ROW: readonly number[] = [0, 0, 0, 1]

export interface RelativePose {
  translationMm: Vec3
  rotationRad: Vec3
}

function linearDet(matrix: Mat4): number {
  const a = matrix[0]
  const b = matrix[1]
  const c = matrix[2]
  const d = matrix[4]
  const e = matrix[5]
  const f = matrix[6]
  const g = matrix[8]
  const h = matrix[9]
  const i = matrix[10]
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
}

/** Конечная матрица 4×4 с нижней строкой [0,0,0,1] и необратимым линейным блоком не принимается. */
export function validateMat4(matrix: Mat4, maxTranslationMm = 2000): void {
  if (matrix.length !== 16) throw new VolumeEngineError('INVALID_TRANSFORM', 'Матрица позы должна быть 4×4.')
  if (matrix.some((value) => !Number.isFinite(value))) {
    throw new VolumeEngineError('INVALID_TRANSFORM', 'В матрице позы есть NaN или бесконечность.')
  }
  for (let index = 0; index < 4; index += 1) {
    const actual = matrix[12 + index] ?? Number.NaN
    const expected = BOTTOM_ROW[index] ?? 0
    if (Math.abs(actual - expected) > 1e-5) {
      throw new VolumeEngineError('INVALID_TRANSFORM', 'Нижняя строка матрицы позы должна быть 0 0 0 1.')
    }
  }
  const translation = translationOf(matrix)
  if (translation.some((value) => Math.abs(value) > maxTranslationMm)) {
    throw new VolumeEngineError('INVALID_TRANSFORM', 'Перенос позы выходит за допустимый диапазон миллиметров.')
  }
  if (Math.abs(linearDet(matrix)) < 1e-8) {
    throw new VolumeEngineError('INVALID_TRANSFORM', 'Линейная часть матрицы позы вырождена.')
  }
}

/** Углы в радианах для соглашения R = Rz · Ry · Rx. */
export function rotationOf(matrix: Mat4): Vec3 {
  validateMat4(matrix)
  const sy = -matrix[8]
  const cy = Math.hypot(matrix[0], matrix[4])
  if (cy > 1e-8) {
    return [Math.atan2(matrix[9], matrix[10]), Math.atan2(sy, cy), Math.atan2(matrix[4], matrix[0])]
  }
  return [Math.atan2(-matrix[6], matrix[5]), Math.atan2(sy, cy), 0]
}

/** Смещение current относительно previous: p_prev = delta · p_current. */
export function relativePose(previous: Mat4, current: Mat4): RelativePose {
  validateMat4(previous)
  validateMat4(current)
  const delta = multiplyMat4(invertMat4(previous), current)
  validateMat4(delta)
  return {
    translationMm: translationOf(delta),
    rotationRad: rotationOf(delta),
  }
}
