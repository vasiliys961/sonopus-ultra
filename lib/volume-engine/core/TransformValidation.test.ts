import { describe, expect, it } from 'vitest'
import { dofToMatrix, IDENTITY, multiplyMat4 } from '@/lib/spatial-reconstruction/rigid'
import { invertMat4, nearlyIdentity } from '@/lib/sono-3d/inverse'
import { relativePose, rotationOf, validateMat4 } from '@/lib/volume-engine/core/TransformValidation'

describe('проверка матриц позы', () => {
  it('принимает единичную матрицу, перенос, поворот и их композицию', () => {
    validateMat4(IDENTITY)
    const translated = dofToMatrix([4, -2, 7], [0, 0, 0])
    const turned = dofToMatrix([0, 0, 0], [0.2, -0.3, 0.4])
    const both = dofToMatrix([4, -2, 7], [0.2, -0.3, 0.4])
    validateMat4(translated)
    validateMat4(turned)
    validateMat4(both)
    expect(nearlyIdentity(multiplyMat4(both, invertMat4(both)))).toBe(true)
  })

  it('отклоняет NaN, плохую нижнюю строку и вырожденный блок', () => {
    const broken = [...IDENTITY] as typeof IDENTITY
    broken[3] = Number.NaN
    expect(() => validateMat4(broken)).toThrow(/NaN|бесконеч/)
    const bottom = [...IDENTITY] as typeof IDENTITY
    bottom[15] = 0
    expect(() => validateMat4(bottom)).toThrow(/Нижняя строка/)
    const flat = [...IDENTITY] as typeof IDENTITY
    flat[0] = 0
    flat[1] = 0
    flat[2] = 0
    expect(() => validateMat4(flat)).toThrow(/вырождена/)
  })

  it('снимает чистый перенос и чистые повороты вокруг осей', () => {
    const shift = relativePose(IDENTITY, dofToMatrix([3, -4, 5], [0, 0, 0]))
    expect(shift.translationMm[0]).toBeCloseTo(3)
    expect(shift.translationMm[1]).toBeCloseTo(-4)
    expect(shift.translationMm[2]).toBeCloseTo(5)
    expect(shift.rotationRad[0]).toBeCloseTo(0)
    expect(rotationOf(dofToMatrix([0, 0, 0], [0.4, 0, 0]))[0]).toBeCloseTo(0.4)
    expect(rotationOf(dofToMatrix([0, 0, 0], [0, -0.3, 0]))[1]).toBeCloseTo(-0.3)
    expect(rotationOf(dofToMatrix([0, 0, 0], [0, 0, 0.25]))[2]).toBeCloseTo(0.25)
  })

  it('собирает относительное смещение из переноса и поворота', () => {
    const previous = dofToMatrix([10, 0, 0], [0, 0, 0.2])
    const local = dofToMatrix([2, -1, 0.5], [0.1, -0.2, 0.3])
    const current = multiplyMat4(previous, local)
    const relative = relativePose(previous, current)
    expect(relative.translationMm[0]).toBeCloseTo(2)
    expect(relative.translationMm[1]).toBeCloseTo(-1)
    expect(relative.translationMm[2]).toBeCloseTo(0.5)
    expect(relative.rotationRad[0]).toBeCloseTo(0.1)
    expect(relative.rotationRad[1]).toBeCloseTo(-0.2)
    expect(relative.rotationRad[2]).toBeCloseTo(0.3)
  })
})
