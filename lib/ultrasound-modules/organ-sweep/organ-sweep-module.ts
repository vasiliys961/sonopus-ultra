import { measurementBase, type OrganModule } from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'

export const organSweepModule: OrganModule = {
  id: 'organ-sweep',
  title: 'Локализация',
  defaultQuestion: 'Что видно в выбранной локализации?',
  requiredViews: ['pass'],
  qualityThreshold: 0.75,
  requiresSpatialScale: false,
  guidance: [
    {
      view: 'pass',
      title: 'Проход',
      text: 'Ведите датчик по проекции органа и держите картинку на экране.',
    },
  ],
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(organSweepModule, frame, score),
  computeMeasurement(request) {
    return measurementBase('organ-sweep', request.calibration, {
      millimeters: null,
      reason: 'Программа не измеряет кадр: шкалы пикселя нет. Размер, который врач продиктовал, этим не отменяется.',
    })
  },
  toFindingsPayload(result) {
    return {
      millimeters: null,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
