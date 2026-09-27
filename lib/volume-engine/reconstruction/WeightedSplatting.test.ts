import { describe, expect, it } from 'vitest'
import { IDENTITY } from '@/lib/spatial-reconstruction/rigid'
import type { WeightGrid } from '@/lib/volume-engine/reconstruction/WeightedSplatting'
import { splatSample } from '@/lib/volume-engine/reconstruction/WeightedSplatting'
import type { SplatSample } from '@/lib/volume-engine/core/VolumeSampler'
import { sampleSlice } from '@/lib/volume-engine/core/VolumeSampler'

function grid(size: [number, number, number]): WeightGrid {
  const cells = size[0] * size[1] * size[2]
  return {
    originMm: [0, 0, 0],
    size,
    spacingMm: [1, 1, 1],
    kernelRadius: 1,
    kernelSigmaMm: 1,
    sums: new Float32Array(cells),
    weights: new Float32Array(cells),
    confidence: new Float32Array(cells),
  }
}

function point(x: number, y: number, z: number, confidence = 1, quality = 1): SplatSample {
  return { point: [x, y, z], gray: 1, confidence, quality }
}

describe('ядро сплаттинга', () => {
  it('кладёт максимум в центральный воксель', () => {
    const target = grid([3, 3, 3])
    splatSample(target, point(1, 1, 1))
    const center = 1 + 3 * (1 + 3 * 1)
    let max = -1
    let maxIndex = -1
    target.weights.forEach((weight, index) => {
      if (weight > max) {
        max = weight
        maxIndex = index
      }
    })
    expect(maxIndex).toBe(center)
  })

  it('делит точку между соседними вокселями', () => {
    const target = grid([3, 1, 1])
    splatSample(target, point(0.5, 0, 0))
    expect(target.weights[0]).toBeGreaterThan(0)
    expect(target.weights[1]).toBeGreaterThan(0)
    expect(Math.abs((target.weights[0] ?? 0) - (target.weights[1] ?? 0))).toBeLessThan(0.15)
  })

  it('не пишет за границу объёма', () => {
    const target = grid([2, 2, 2])
    expect(() => splatSample(target, point(0, 0, 0))).not.toThrow()
    expect(target.weights.length).toBe(8)
    expect(target.weights.every((weight) => Number.isFinite(weight))).toBe(true)
  })

  it('снижает вклад при низкой уверенности и низком качестве', () => {
    const full = grid([3, 3, 3])
    const shy = grid([3, 3, 3])
    const dull = grid([3, 3, 3])
    splatSample(full, point(1, 1, 1, 1, 1))
    splatSample(shy, point(1, 1, 1, 0.25, 1))
    splatSample(dull, point(1, 1, 1, 1, 0.25))
    const sum = (item: WeightGrid) => item.weights.reduce((total, weight) => total + weight, 0)
    expect(sum(shy)).toBeCloseTo(sum(full) * 0.25)
    expect(sum(dull)).toBeCloseTo(sum(full) * 0.25)
  })

  it('накапливает несколько кадров', () => {
    const target = grid([3, 3, 3])
    splatSample(target, point(1, 1, 1))
    const once = target.weights.reduce((total, weight) => total + weight, 0)
    splatSample(target, point(1, 1, 1))
    const twice = target.weights.reduce((total, weight) => total + weight, 0)
    expect(twice).toBeCloseTo(once * 2)
  })

  it('шаг пикселя уменьшает число проб и не смешивает оси шкалы', () => {
    const image = new Float32Array(16)
    image.fill(1)
    const slice = {
      frameId: 'stride',
      timestamp: 0,
      image,
      width: 4,
      height: 4,
      transform: IDENTITY,
      confidence: 1,
      pixelSpacingX: 0.5,
      pixelSpacingY: 2,
      quality: 1,
      source: 'ultrasound' as const,
    }
    const dense = sampleSlice(slice, { pixelStride: 1, maxSamplesPerFrame: 100 })
    const sparse = sampleSlice(slice, { pixelStride: 2, maxSamplesPerFrame: 100 })
    expect(sparse.length).toBeLessThan(dense.length)
    const shifted = transformPointSafe(slice.pixelSpacingX)
    expect(dense.some((sample) => Math.abs(sample.point[0] - shifted) < 1e-6)).toBe(true)
    expect(dense.some((sample) => sample.point[1] !== 0)).toBe(true)
  })
})

function transformPointSafe(spacingX: number): number {
  return (0.5 - 2) * spacingX
}
