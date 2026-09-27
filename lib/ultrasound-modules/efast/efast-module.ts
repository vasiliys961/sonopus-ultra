import { measurementBase, type OrganModule } from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'

export const EFAST_POINTS = ['RUQ', 'LUQ', 'pelvis', 'subxiphoid'] as const
export type EfastPoint = (typeof EFAST_POINTS)[number]

const TITLES: Record<EfastPoint, string> = {
  RUQ: 'Правое подреберье',
  LUQ: 'Левое подреберье',
  pelvis: 'Таз',
  subxiphoid: 'Подмечевидная точка',
}

export const efastModule: OrganModule = {
  id: 'efast',
  title: 'eFAST',
  defaultQuestion: 'Есть ли свободная жидкость в четырёх точках eFAST?',
  requiredViews: EFAST_POINTS,
  qualityThreshold: 0.75,
  requiresSpatialScale: false,
  guidance: EFAST_POINTS.map((point) => ({
    view: point,
    title: TITLES[point],
    text: `Снимите точку ${TITLES[point]}. Наличие жидкости отмечает врач: модуль не угадывает её по яркости кадра.`,
  })),
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(efastModule, frame, score),
  computeMeasurement(request) {
    if (request.manual?.kind !== 'efast') {
      return measurementBase('efast', request.calibration, { reason: 'четыре точки ещё не отмечены' })
    }
    const points = request.manual.points
    const missing = EFAST_POINTS.filter((point) => points[point] === null)
    if (missing.length > 0) {
      return measurementBase('efast', request.calibration, {
        points,
        reason: `не отмечены точки: ${missing.join(', ')}`,
      })
    }
    const positive = EFAST_POINTS.filter((point) => points[point] === true).length
    return measurementBase('efast', request.calibration, { points, scale: 'not-applicable' }, positive, 'count')
  },
  toFindingsPayload(result) {
    return {
      points: result.raw.points ?? null,
      positive_points: result.value ?? null,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
