import type { Vec3 } from '@/lib/spatial-reconstruction/types'
import type { Phantom, PhantomGroundTruth } from '@/benchmark/freehand3d/phantoms/types'

function hypot(point: Vec3, center: Vec3): number {
  return Math.hypot(point[0] - center[0], point[1] - center[1], point[2] - center[2])
}

export function spherePhantom(center: Vec3 = [0, 0, 0], radiusMm = 6): Phantom {
  const diameter = radiusMm * 2
  const truth: PhantomGroundTruth = {
    bounds: {
      min: [center[0] - radiusMm, center[1] - radiusMm, center[2] - radiusMm],
      max: [center[0] + radiusMm, center[1] + radiusMm, center[2] + radiusMm],
    },
    centroid: center,
    volumeMm3: (4 / 3) * Math.PI * radiusMm ** 3,
    dimensionsMm: [diameter, diameter, diameter],
    diameterMm: diameter,
    measurements: [0, 1, 2].map((axis) => ({ name: 'diameter' as const, expectedMm: diameter, axis: axis as 0 | 1 | 2 })),
  }
  return {
    id: 'sphere',
    truth,
    contains: (point) => hypot(point, center) <= radiusMm,
  }
}

export function cylinderPhantom(center: Vec3 = [0, 0, 0], radiusMm = 4, lengthMm = 16): Phantom {
  const half = lengthMm / 2
  const truth: PhantomGroundTruth = {
    bounds: {
      min: [center[0] - radiusMm, center[1] - radiusMm, center[2] - half],
      max: [center[0] + radiusMm, center[1] + radiusMm, center[2] + half],
    },
    centroid: center,
    volumeMm3: Math.PI * radiusMm ** 2 * lengthMm,
    dimensionsMm: [radiusMm * 2, radiusMm * 2, lengthMm],
    diameterMm: radiusMm * 2,
    lengthMm,
    measurements: [
      { name: 'diameter', expectedMm: radiusMm * 2, axis: 0 },
      { name: 'length', expectedMm: lengthMm, axis: 2 },
    ],
  }
  return {
    id: 'cylinder',
    truth,
    contains: (point) => Math.hypot(point[0] - center[0], point[1] - center[1]) <= radiusMm && Math.abs(point[2] - center[2]) <= half,
  }
}

export function parallelCylindersPhantom(): Phantom {
  const radiusMm = 3
  const lengthMm = 12
  const gap = 12
  const half = lengthMm / 2
  const left: Vec3 = [-gap / 2, 0, 0]
  const right: Vec3 = [gap / 2, 0, 0]
  const truth: PhantomGroundTruth = {
    bounds: {
      min: [left[0] - radiusMm, -radiusMm, -half],
      max: [right[0] + radiusMm, radiusMm, half],
    },
    centroid: [0, 0, 0],
    volumeMm3: 2 * Math.PI * radiusMm ** 2 * lengthMm,
    dimensionsMm: [gap + radiusMm * 2, radiusMm * 2, lengthMm],
    diameterMm: radiusMm * 2,
    lengthMm,
    distanceBetweenStructuresMm: gap,
    measurements: [
      { name: 'diameter', expectedMm: radiusMm * 2, axis: 1 },
      { name: 'length', expectedMm: lengthMm, axis: 2 },
      { name: 'separation', expectedMm: gap, axis: 'components' },
    ],
  }
  return {
    id: 'parallel-cylinders',
    truth,
    contains: (point) => {
      const along = Math.abs(point[2]) <= half
      const nearLeft = Math.hypot(point[0] - left[0], point[1] - left[1]) <= radiusMm
      const nearRight = Math.hypot(point[0] - right[0], point[1] - right[1]) <= radiusMm
      return along && (nearLeft || nearRight)
    },
  }
}

export function curvedTubePhantom(): Phantom {
  const bendRadius = 10
  const tubeRadius = 2
  const samples: Vec3[] = []
  for (let index = 0; index <= 48; index += 1) {
    const angle = (index / 48) * (Math.PI / 2)
    samples.push([bendRadius * Math.cos(angle), 0, bendRadius * Math.sin(angle)])
  }
  const centroid = samples.reduce<Vec3>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0])
    .map((value) => value / samples.length) as Vec3
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const point of samples) {
    minX = Math.min(minX, point[0] - tubeRadius)
    minY = Math.min(minY, point[1] - tubeRadius)
    minZ = Math.min(minZ, point[2] - tubeRadius)
    maxX = Math.max(maxX, point[0] + tubeRadius)
    maxY = Math.max(maxY, point[1] + tubeRadius)
    maxZ = Math.max(maxZ, point[2] + tubeRadius)
  }
  const arcLength = bendRadius * (Math.PI / 2)
  return {
    id: 'curved-tube',
    truth: {
      bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      centroid,
      volumeMm3: arcLength * Math.PI * tubeRadius ** 2,
      dimensionsMm: [maxX - minX, maxY - minY, maxZ - minZ],
      diameterMm: tubeRadius * 2,
      lengthMm: arcLength,
      measurements: [
        { name: 'length', expectedMm: arcLength, axis: 'arc' },
        { name: 'centerline', expectedMm: 0, axis: 'arc' },
      ],
    },
    centerline: samples,
    contains: (point) => {
      const angle = Math.min(Math.PI / 2, Math.max(0, Math.atan2(point[2], point[0])))
      const closest: Vec3 = [bendRadius * Math.cos(angle), 0, bendRadius * Math.sin(angle)]
      return hypot(point, closest) <= tubeRadius
    },
  }
}
