import { hasMeasurementScale, measurementBase, type OrganModule } from '@/lib/domain/types'
import { computeEllipsoidVolumeMl } from '@/lib/ultrasound-modules/shared/ellipsoid-volume'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'

function lobe(depthMm: number, widthMm: number, heightMm: number): number {
  return computeEllipsoidVolumeMl(depthMm, widthMm, heightMm)
}

export const thyroidModule: OrganModule = {
  id: 'thyroid',
  title: 'Щитовидная железа',
  defaultQuestion: 'Оценить объём правой и левой долей щитовидной железы.',
  requiredViews: ['right-lobe', 'left-lobe'],
  qualityThreshold: 0.75,
  requiresSpatialScale: true,
  guidance: [
    {
      view: 'right-lobe',
      title: 'Правая доля',
      text: 'Снимите правую долю в двух взаимно перпендикулярных плоскостях и перенесите три размера с калиперов аппарата.',
    },
    {
      view: 'left-lobe',
      title: 'Левая доля',
      text: 'Повторите то же для левой доли. Объём считается той же эллипсоидной формулой, что и для мочевого пузыря.',
    },
  ],
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(thyroidModule, frame, score),
  computeMeasurement(request) {
    if (!hasMeasurementScale(request.calibration)) {
      return measurementBase('thyroid', request.calibration, {
        reason: 'без подтверждённой шкалы объём доли не вычисляется',
      })
    }
    if (request.manual?.kind !== 'thyroid') {
      return measurementBase('thyroid', request.calibration, { reason: 'нет размеров обеих долей' })
    }
    try {
      const volumeRightMl = lobe(request.manual.right.depthMm, request.manual.right.widthMm, request.manual.right.heightMm)
      const volumeLeftMl = lobe(request.manual.left.depthMm, request.manual.left.widthMm, request.manual.left.heightMm)
      return measurementBase(
        'thyroid',
        request.calibration,
        { volumeRightMl, volumeLeftMl },
        volumeRightMl + volumeLeftMl,
        'ml',
      )
    } catch (error) {
      return measurementBase('thyroid', request.calibration, {
        reason: error instanceof Error ? error.message : 'размеры доли отклонены',
      })
    }
  },
  toFindingsPayload(result) {
    return {
      volumeRightMl: result.raw.volumeRightMl ?? null,
      volumeLeftMl: result.raw.volumeLeftMl ?? null,
      volumeTotalMl: result.value ?? null,
      calibration: result.calibration,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
