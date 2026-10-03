import { dofToMatrix } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'

export interface RigidFit {
  matrix: Mat4
  confidence: number
}

export function rigidFromLandmarks(source: readonly Vec3[], target: readonly Vec3[]): RigidFit | null {
  if (source.length === 0 || source.length !== target.length) return null
  const from = centroid(source)
  const to = centroid(target)
  if (source.length === 1) {
    return {
      matrix: dofToMatrix([to[0] - from[0], to[1] - from[1], to[2] - from[2]], [0, 0, 0]),
      confidence: 0.4,
    }
  }
  const left = direction(source[0], source[1])
  const right = direction(target[0], target[1])
  if (!left || !right) {
    return {
      matrix: dofToMatrix([to[0] - from[0], to[1] - from[1], to[2] - from[2]], [0, 0, 0]),
      confidence: 0.3,
    }
  }
  const rotation = rotationFromTo(left, right)
  const rotated = apply3(rotation, from)
  const shift: Vec3 = [to[0] - rotated[0], to[1] - rotated[1], to[2] - rotated[2]]
  return {
    matrix: [
      rotation[0], rotation[1], rotation[2], shift[0],
      rotation[3], rotation[4], rotation[5], shift[1],
      rotation[6], rotation[7], rotation[8], shift[2],
      0, 0, 0, 1,
    ],
    confidence: source.length >= 3 ? 0.7 : 0.55,
  }
}

export function applyRigid(matrix: Mat4, point: Vec3): Vec3 {
  return [
    matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
    matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
    matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
  ]
}

/** Тяжёлая деформация не стартует сама. */
export function deformableRegistration(): { applied: false; reason: string } {
  return { applied: false, reason: 'Деформируемая регистрация не запускается сама.' }
}

export function affineRegistration(): { applied: false; reason: string } {
  return { applied: false, reason: 'Аффинная регистрация ждёт явные ориентиры и не стартует сама.' }
}

function centroid(points: readonly Vec3[]): Vec3 {
  const sum: Vec3 = [0, 0, 0]
  for (const point of points) {
    sum[0] += point[0]
    sum[1] += point[1]
    sum[2] += point[2]
  }
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

function direction(from: Vec3 | undefined, to: Vec3 | undefined): Vec3 | null {
  if (!from || !to) return null
  const vector: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length < 1e-8) return null
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function rotationFromTo(from: Vec3, to: Vec3): number[] {
  const cross: Vec3 = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ]
  const sine = Math.hypot(cross[0], cross[1], cross[2])
  const cosine = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  if (sine < 1e-8) {
    if (cosine > 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const axis: Vec3 = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    return rotationAround(axis, Math.PI)
  }
  return rotationAround([cross[0] / sine, cross[1] / sine, cross[2] / sine], Math.atan2(sine, cosine))
}

function rotationAround(axis: Vec3, angle: number): number[] {
  const [x, y, z] = axis
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ]
}

function apply3(rotation: number[], point: Vec3): Vec3 {
  return [
    rotation[0] * point[0] + rotation[1] * point[1] + rotation[2] * point[2],
    rotation[3] * point[0] + rotation[4] * point[1] + rotation[5] * point[2],
    rotation[6] * point[0] + rotation[7] * point[1] + rotation[8] * point[2],
  ]
}
