import { measurementBase, type OrganModule } from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'

export const MULTI_ANGLE_VIEWS = ['angle-0', 'angle-45', 'angle-90', 'probe-vertical', 'probe-horizontal'] as const

const GUIDANCE: Record<(typeof MULTI_ANGLE_VIEWS)[number], { title: string; text: string }> = {
  'angle-0': {
    title: 'Ракурс 0°',
    text: 'Поставьте датчик в исходную плоскость и снимите её. Этот кадр — ноль, от него отсчитываются следующие повороты.',
  },
  'angle-45': {
    title: 'Ракурс 45°',
    text: 'Поверните датчик на 45° влево от исходной плоскости и снимите тот же объект. Угол подтверждаете вы, программа положение датчика не отслеживает.',
  },
  'angle-90': {
    title: 'Ракурс 90°',
    text: 'Поверните датчик до 90°, поперёк исходной плоскости, и снимите тот же объект.',
  },
  'probe-vertical': {
    title: 'Датчик вертикально',
    text: 'Держите датчик вертикально и снимите тот же объект.',
  },
  'probe-horizontal': {
    title: 'Датчик горизонтально',
    text: 'Держите датчик горизонтально и снимите тот же объект.',
  },
}

export const multiAngleModule: OrganModule = {
  id: 'multi-angle',
  title: 'Несколько ракурсов',
  defaultQuestion: 'Что видно по одному объекту, снятому с нескольких заявленных ракурсов?',
  requiredViews: MULTI_ANGLE_VIEWS,
  qualityThreshold: 0.75,
  requiresSpatialScale: false,
  guidance: MULTI_ANGLE_VIEWS.map((view) => ({ view, ...GUIDANCE[view] })),
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(multiAngleModule, frame, score),
  computeMeasurement(request) {
    const obtained = MULTI_ANGLE_VIEWS.filter((view) => (request.viewQuality?.[view] ?? 0) >= multiAngleModule.qualityThreshold)
    const missing = MULTI_ANGLE_VIEWS.filter((view) => !obtained.includes(view))
    if (obtained.length === 0) {
      return measurementBase('multi-angle', request.calibration, {
        angles: [],
        missing: [...missing],
        reason: 'нет ни одного подтверждённого ракурса',
      })
    }
    return measurementBase(
      'multi-angle',
      request.calibration,
      { angles: obtained, missing: [...missing], reconstruction: 'none' },
      obtained.length,
      'count',
    )
  },
  toFindingsPayload(result) {
    return {
      angles: result.raw.angles ?? [],
      missing_angles: result.raw.missing ?? [],
      angle_count: result.value ?? null,
      reconstruction: 'none',
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
