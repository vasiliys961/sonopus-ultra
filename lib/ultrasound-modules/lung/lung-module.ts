import { measurementBase, type OrganModule } from '@/lib/domain/types'
import { rasterToGray } from '@/lib/quality/gray'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'
import { countVerticalBrightLines } from '@/lib/ultrasound-modules/lung/measurement'

export const LUNG_ZONES = ['right-upper', 'right-lower', 'left-upper', 'left-lower'] as const

export const lungModule: OrganModule = {
  id: 'lung',
  title: 'Лёгкие',
  defaultQuestion: 'Есть ли B-линии и в каких зонах?',
  requiredViews: LUNG_ZONES,
  qualityThreshold: 0.75,
  requiresSpatialScale: false,
  guidance: [
    {
      view: 'right-upper',
      title: 'Правая верхняя зона',
      text: 'Удерживайте зону. Подсчёт ярких вертикальных линий — техническая эвристика; врач может заменить число своим.',
    },
    {
      view: 'right-lower',
      title: 'Правая нижняя зона',
      text: 'Снимите правую нижнюю зону отдельно от верхней.',
    },
    {
      view: 'left-upper',
      title: 'Левая верхняя зона',
      text: 'Снимите левую верхнюю зону.',
    },
    {
      view: 'left-lower',
      title: 'Левая нижняя зона',
      text: 'Снимите левую нижнюю зону.',
    },
  ],
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(lungModule, frame, score),
  computeMeasurement(request) {
    if (request.manual?.kind === 'lung') {
      const zones = request.manual.zoneCounts
      let total = 0
      for (const zone of LUNG_ZONES) {
        const count = zones[zone]
        if (!Number.isInteger(count) || count === undefined || count < 0 || count > 20) {
          return measurementBase('lung', request.calibration, {
            reason: `зона ${zone}: ожидается целое число линий от 0 до 20`,
          })
        }
        total += count
      }
      return measurementBase(
        'lung',
        request.calibration,
        { zones, method: 'operator', scale: 'not-applicable' },
        total,
        'count',
      )
    }
    if (request.frames.length === 0) {
      return measurementBase('lung', request.calibration, { reason: 'нет кадра зоны' })
    }
    const zones: Record<string, number> = {}
    request.frames.forEach((frame, index) => {
      const zone = LUNG_ZONES[index] ?? `frame-${index}`
      const gray = rasterToGray(frame.imageData)
      zones[zone] = countVerticalBrightLines(gray, frame.imageData.width, frame.imageData.height)
    })
    const total = Object.values(zones).reduce((sum, count) => sum + count, 0)
    return measurementBase(
      'lung',
      request.calibration,
      { zones, method: 'vertical-line-heuristic', scale: 'not-applicable' },
      total,
      'count',
    )
  },
  toFindingsPayload(result) {
    return {
      zones: result.raw.zones ?? null,
      total_lines: result.value ?? null,
      method: result.raw.method ?? null,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
