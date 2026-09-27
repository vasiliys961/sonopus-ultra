import { IDENTITY, multiplyMat4 } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4 } from '@/lib/spatial-reconstruction/types'

/** Обратная матрица позы. Нужна, чтобы проверить, что композиция возвращает точку на место. */
export function invertMat4(matrix: Mat4): Mat4 {
  const rows = Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_, col) => {
    if (col < 4) return matrix[row * 4 + col]
    return col - 4 === row ? 1 : 0
  }))
  for (let col = 0; col < 4; col += 1) {
    let pivot = col
    for (let row = col + 1; row < 4; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    }
    if (Math.abs(rows[pivot][col]) < 1e-12) throw new Error('матрица позы необратима')
    const hold = rows[col]
    rows[col] = rows[pivot]
    rows[pivot] = hold
    const divisor = rows[col][col]
    for (let k = 0; k < 8; k += 1) rows[col][k] /= divisor
    for (let row = 0; row < 4; row += 1) {
      if (row === col) continue
      const factor = rows[row][col]
      for (let k = 0; k < 8; k += 1) rows[row][k] -= factor * rows[col][k]
    }
  }
  const out = [] as number[] as Mat4
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) out[row * 4 + col] = rows[row][col + 4]
  }
  return out
}

export function nearlyIdentity(matrix: Mat4, epsilon = 1e-6): boolean {
  return matrix.every((value, index) => Math.abs(value - IDENTITY[index]) <= epsilon)
}

export function roundTrip(matrix: Mat4): Mat4 {
  return multiplyMat4(matrix, invertMat4(matrix))
}
