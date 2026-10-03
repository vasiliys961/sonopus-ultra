import { describe, expect, it } from 'vitest'
import { buildSpatialPreview } from '@/lib/intelligence/build-preview'
import { planeDiff } from '@/lib/intelligence/gray'
import { parallelStack, probeTravel } from '@/lib/intelligence/parallel-stack'
import { projectObserved } from '@/lib/intelligence/project-volume'
import { sampleCine, type CineFrame } from '@/lib/intelligence/sample-cine'

function frame(id: string, timestamp: number, paint: (gray: Float32Array, width: number, height: number) => void): CineFrame {
  const width = 32
  const height = 24
  const gray = new Float32Array(width * height)
  gray.fill(0.08)
  paint(gray, width, height)
  return { id, timestamp, quality: 0.9, plane: { gray, width, height } }
}

function block(gray: Float32Array, width: number, x0: number, y0: number) {
  for (let dy = 0; dy < 4; dy += 1) {
    for (let dx = 0; dx < 4; dx += 1) gray[(y0 + dy) * width + (x0 + dx)] = 0.9
  }
}

function disc(gray: Float32Array, width: number, height: number, cx: number, cy: number, radius: number, tone: number) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) gray[y * width + x] = tone
    }
  }
}

describe('spatial preview', () => {
  it('turns an in-plane slide into a probe step', () => {
    const still = frame('a', 0, (gray, width) => block(gray, width, 8, 8))
    const slid = frame('b', 100, (gray, width) => block(gray, width, 11, 8))
    const stack = parallelStack([still, slid])
    expect(stack[1]?.probe).toEqual({ x: -3, y: 0, z: stack[1]?.depth })
    expect(stack[1]?.transform[3]).toBe(-3)
    expect(stack[1]?.gray[8 * 32 + 11]).toBeCloseTo(0.9)
    expect(probeTravel(stack.map((slice) => ({ probeX: slice.probe.x, probeY: slice.probe.y, depth: slice.depth }))).lateral).toBe(3)
  })

  it('keeps a slight change inside a candidate window', () => {
    const gray = new Float32Array(64).fill(0.2)
    const near = new Float32Array(gray)
    near[0] = 0.4
    near[1] = 0.4
    near[2] = 0.4
    near[3] = 0.4
    const base = { quality: 0.9, plane: { gray, width: 8, height: 8 } }
    const frames = [
      { ...base, id: 'a', timestamp: 0 },
      { id: 'b', timestamp: 100, quality: 0.9, plane: { gray: near, width: 8, height: 8 } },
    ]
    expect(sampleCine(frames).map((item) => item.id)).toEqual(['a'])
    const windows = [{ from: 50, to: 150, duplicateDiff: 0.004 }]
    expect(sampleCine(frames, { windows }).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('drops near-duplicate frames and keeps a change', () => {
    const still = frame('a', 0, (gray, width, height) => disc(gray, width, height, 10, 12, 4, 0.8))
    const copy = frame('b', 100, (gray, width, height) => disc(gray, width, height, 10, 12, 4, 0.8))
    const moved = frame('c', 200, (gray, width, height) => disc(gray, width, height, 22, 12, 5, 0.2))
    expect(planeDiff(still.plane, copy.plane)).toBeLessThan(0.035)
    const kept = sampleCine([still, copy, moved])
    expect(kept.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('stacks a changing sweep along depth and builds an observed volume', async () => {
    const frames = Array.from({ length: 8 }, (_, index) => frame(`f${index}`, index * 400, (gray, width, height) => {
      disc(gray, width, height, 6 + index * 3, 8 + (index % 3), 5, 0.9)
    }))
    const stack = parallelStack(sampleCine(frames))
    expect(stack.length).toBeGreaterThan(3)
    expect(stack[stack.length - 1]?.depth).toBeGreaterThan(stack[0]?.depth ?? 0)
    expect(Math.hypot(stack[stack.length - 1]?.probe.x ?? 0, stack[stack.length - 1]?.probe.y ?? 0)).toBeGreaterThan(0)
    const preview = await buildSpatialPreview(frames)
    expect(preview.measuresAllowed).toBe(false)
    expect(preview.pose).toBe('VIDEO_ESTIMATION')
    expect(preview.accepted).toBeGreaterThan(3)
    expect(preview.volume.size[2]).toBeGreaterThan(1)
    expect(preview.note).toContain('по глубине')
    expect(preview.note).not.toContain('тонкий')
    expect(preview.coverage).toBeGreaterThan(0)
    const picture = projectObserved(preview.volume, 0.6)
    const lit = picture.rgba.filter((_, index) => index % 4 === 3 && picture.rgba[index] === 255).length
    expect(lit).toBeGreaterThan(10)
  })
})
