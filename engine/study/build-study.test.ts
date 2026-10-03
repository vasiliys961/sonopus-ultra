import { describe, expect, it } from 'vitest'
import { decodeBudget, sampleTimes } from '@/engine/cine/cine-decoder'
import { aiFrameBudget } from '@/engine/ai/frame-budget'
import { liverPrior } from '@/engine/anatomy/liver'
import { applyRigid, deformableRegistration, rigidFromLandmarks } from '@/engine/registration/rigid'
import { admitPathology } from '@/engine/pathology/gate'
import { buildStudy } from '@/engine/study/build-study'
import type { CineFrame } from '@/lib/intelligence/sample-cine'

function frame(id: string, timestamp: number, paint: (gray: Float32Array, width: number, height: number) => void, quality = 0.9): CineFrame {
  const width = 32
  const height = 24
  const gray = new Float32Array(width * height)
  gray.fill(0.12)
  paint(gray, width, height)
  return { id, timestamp, quality, plane: { gray, width, height } }
}

function disc(gray: Float32Array, width: number, height: number, cx: number, cy: number) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 25) gray[y * width + x] = 0.95
    }
  }
}

describe('study pipeline', () => {
  it('blocks a lesion search when the frames are not usable', () => {
    expect(admitPathology([{ quality: { usable: false } }], 4)).toBe(false)
    expect(admitPathology([{ quality: { usable: true } }], 0)).toBe(false)
    expect(admitPathology([{ quality: { usable: true } }], 2)).toBe(true)
  })

  it('does not freeze video sampling at 12 frames', () => {
    expect(sampleTimes(1).length).toBeGreaterThan(12)
    expect(sampleTimes(40).length).toBe(120)
    expect(decodeBudget(20_000, 400)).toBe(120)
    expect(aiFrameBudget(['a', 'b', 'c'], []).maximum).toBe(24)
  })

  it('rotates a landmark pair without starting deformable registration', () => {
    const fit = rigidFromLandmarks([[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0]])
    expect(fit).not.toBeNull()
    const moved = applyRigid(fit!.matrix, [1, 0, 0])
    expect(moved[0]).toBeCloseTo(0, 4)
    expect(moved[1]).toBeCloseTo(1, 4)
    expect(deformableRegistration().applied).toBe(false)
  })

  it('builds a liver study with an unconfirmed atlas and no diagnosis', async () => {
    const frames = Array.from({ length: 8 }, (_, index) => frame(`f${index}`, index * 400, (gray, width, height) => {
      disc(gray, width, height, 8 + index * 2, 12)
    }))
    const built = await buildStudy(frames)
    expect(built.study.organ).toBe('liver')
    expect(built.study.measuresAllowed).toBe(false)
    expect(built.study.pose).toBe('VIDEO_ESTIMATION')
    expect(liverPrior().every((node) => node.observed === false)).toBe(true)
    expect(built.study.anatomy.every((node) => node.observed === false)).toBe(true)
    expect(built.study.report.conclusion.toLowerCase()).not.toContain('подтвержд')
    expect(built.study.report.conclusion).toContain('не поставлен')
    expect(built.study.candidates.every((item) => item.provenance.confidence.overall < 0.8)).toBe(true)
    expect(built.study.tissue.every((item) => item.basis === 'относительная яркость эхо')).toBe(true)
    expect(built.study.candidates.every((item) => item.provenance.coordinates.x === item.location.x)).toBe(true)
    expect(built.preview.accepted).toBeGreaterThan(3)
    expect(built.study.report.limitations.join(' ')).toContain('Слияние не выполняется')
    expect(built.study.report.limitations.join(' ')).toContain('Деформируемая регистрация не запускается сама')
  })
})
