import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

export const IDENTITY: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]

export function multiplyMat4(left: Mat4, right: Mat4): Mat4 {
  const out = [] as number[] as Mat4
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += left[row * 4 + k] * right[k * 4 + col]
      out[row * 4 + col] = sum
    }
  }
  return out
}

export function transformPoint(matrix: Mat4, point: Vec3): Vec3 {
  return [
    matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
    matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
    matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
  ]
}

export function translationOf(matrix: Mat4): Vec3 {
  return [matrix[3], matrix[7], matrix[11]]
}

/** Поворот R = Rz · Ry · Rx, затем перенос в миллиметрах. Углы в радианах. */
export function dofToMatrix(translationMm: Vec3, rotationRad: Vec3): Mat4 {
  const [rx, ry, rz] = rotationRad
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, translationMm[0],
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, translationMm[1],
    -sy, cy * sx, cy * cx, translationMm[2],
    0, 0, 0, 1,
  ]
}
