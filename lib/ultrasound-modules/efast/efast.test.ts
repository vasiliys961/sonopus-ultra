import { describe, expect, it } from 'vitest'
import { efastModule } from '@/lib/ultrasound-modules/efast/efast-module'

const calibration = { status: 'unavailable' as const, reason: 'для бинарной карты шкала не нужна' }

describe('eFAST', () => {
  it('считает положительные точки только когда отмечены все четыре', () => {
    const result = efastModule.computeMeasurement({
      frames: [],
      calibration,
      manual: { kind: 'efast', points: { RUQ: true, LUQ: false, pelvis: true, subxiphoid: false } },
    })
    expect(result.value).toBe(2)
    expect(result.unit).toBe('count')
    expect(efastModule.toFindingsPayload(result).points).toMatchObject({ RUQ: true, LUQ: false })
  })

  it('не подставляет «жидкости нет», если точка не отмечена', () => {
    const result = efastModule.computeMeasurement({
      frames: [],
      calibration,
      manual: { kind: 'efast', points: { RUQ: true, LUQ: null, pelvis: false, subxiphoid: false } },
    })
    expect(result.value).toBeUndefined()
    expect(String(result.raw.reason)).toMatch(/LUQ/)
  })
})
