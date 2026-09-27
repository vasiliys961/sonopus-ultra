import {
  hasMeasurementScale,
  hasPixelScale,
  measurementBase,
  type MeasurementRequest,
  type OrganModule,
} from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'
import { computeCollapsibilityIndex } from '@/lib/ultrasound-modules/ivc/measurement'

function indexResult(
  request: MeasurementRequest,
  diameters: number[],
  extra: Record<string, unknown>,
) {
  try {
    const index = computeCollapsibilityIndex(diameters)
    const dMax = Math.max(...diameters)
    const dMin = Math.min(...diameters)
    return measurementBase(
      'ivc',
      request.calibration,
      { ...extra, dMax, dMin, index },
      index,
      'ratio',
    )
  } catch (error) {
    return measurementBase('ivc', request.calibration, {
      ...extra,
      reason: error instanceof Error ? error.message : 'серия диаметров отклонена',
    })
  }
}

export const ivcModule: OrganModule = {
  id: 'ivc',
  title: 'Нижняя полая вена',
  defaultQuestion: 'Оценить коллапсибельность нижней полой вены за дыхательный цикл.',
  requiredViews: ['longitudinal-ivc'],
  qualityThreshold: 0.75,
  requiresSpatialScale: false,
  guidance: [
    {
      view: 'longitudinal-ivc',
      title: 'Продольный срез НПВ',
      text: 'Выведите нижнюю полую вену в продольной плоскости и удерживайте её в кадре на протяжении вдоха и выдоха. Диаметр серии снимается вручную или по перепаду яркости вдоль строки.',
    },
  ],
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(ivcModule, frame, score),
  computeMeasurement(request) {
    if (request.manual?.kind === 'ivc') {
      if (!hasMeasurementScale(request.calibration)) {
        return measurementBase('ivc', request.calibration, {
          reason: 'числа в миллиметрах без подтверждённой шкалы не используются',
        })
      }
      return indexResult(request, request.manual.diametersMm, { unit: 'mm', source: 'operator' })
    }
    const series = request.diameterSeriesPx ?? []
    const calibration = request.calibration
    if (series.length >= 2) {
      const indexOnly = indexResult(request, series, { unit: 'px', source: 'series' })
      if (!hasPixelScale(calibration)) {
        return {
          ...indexOnly,
          calibration: 'unavailable',
          raw: { ...indexOnly.raw, millimeters: 'unavailable' },
        }
      }
      const mm = series.map((px) => px * calibration.mmPerPixel)
      return indexResult(request, mm, { unit: 'mm', source: 'pixel-spacing', diametersPx: series })
    }
    return measurementBase('ivc', request.calibration, {
      reason: 'нет серии диаметров за дыхательный цикл',
    })
  },
  toFindingsPayload(result) {
    return {
      collapsibility_index: result.value,
      d_max: result.raw.dMax ?? null,
      d_min: result.raw.dMin ?? null,
      calibration: result.calibration,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
