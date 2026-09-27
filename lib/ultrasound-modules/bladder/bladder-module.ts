import {
  hasMeasurementScale,
  measurementBase,
  type MeasurementRequest,
  type OrganModule,
} from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'
import { bladderFindings } from '@/lib/ultrasound-modules/bladder/findings-schema'
import { bladderGuidance } from '@/lib/ultrasound-modules/bladder/guidance'
import { computeBladderVolume } from '@/lib/ultrasound-modules/bladder/measurement'
import { BLADDER_VIEWS } from '@/lib/ultrasound-modules/bladder/protocol'

export const bladderModule: OrganModule = {
  id: 'bladder',
  title: 'Мочевой пузырь',
  defaultQuestion: 'Оценить объём мочевого пузыря и признаки задержки мочи.',
  requiredViews: BLADDER_VIEWS,
  qualityThreshold: 0.75,
  requiresSpatialScale: true,
  guidance: bladderGuidance,
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(bladderModule, frame, score),
  computeMeasurement(request: MeasurementRequest) {
    const viewQuality = request.viewQuality ?? {}
    const shared = {
      view_transverse_quality: viewQuality.transverse ?? null,
      view_longitudinal_quality: viewQuality.longitudinal ?? null,
    }
    if (!hasMeasurementScale(request.calibration)) {
      return measurementBase(bladderModule.id, request.calibration, {
        ...shared,
        reason: request.calibration.status === 'unavailable' ? request.calibration.reason : 'калибровка недоступна',
      })
    }
    if (request.manual?.kind !== 'bladder') {
      return measurementBase(bladderModule.id, request.calibration, {
        ...shared,
        reason: 'нет трёх размеров пузыря',
      })
    }
    try {
      const volume = computeBladderVolume(
        request.manual.depthMm,
        request.manual.widthMm,
        request.manual.heightMm,
      )
      return measurementBase(
        bladderModule.id,
        request.calibration,
        { ...shared, depthMm: request.manual.depthMm, widthMm: request.manual.widthMm, heightMm: request.manual.heightMm },
        volume,
        'ml',
      )
    } catch (error) {
      return measurementBase(bladderModule.id, request.calibration, {
        ...shared,
        reason: error instanceof Error ? error.message : 'размеры отклонены',
      })
    }
  },
  toFindingsPayload: bladderFindings,
}
