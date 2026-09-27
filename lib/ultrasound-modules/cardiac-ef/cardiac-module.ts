import { hasMeasurementScale, hasPixelScale, measurementBase, type OrganModule, type Point } from '@/lib/domain/types'
import { acceptByTechnicalQuality } from '@/lib/ultrasound-modules/shared/technical-acceptance'
import {
  computeEF,
  diametersFromContour,
  simpsonBiplaneVolumeMl,
  simpsonDisksVolumeMl,
} from '@/lib/ultrasound-modules/cardiac-ef/measurement'

function volumeFromContour(points: Point[] | undefined, mmPerPixel: number): number | null {
  if (!points || points.length < 8) return null
  const disks = diametersFromContour(points)
  if (!disks) return null
  return simpsonDisksVolumeMl(
    disks.diametersPx.map((px) => px * mmPerPixel),
    disks.sliceHeightPx * mmPerPixel,
  )
}

export const cardiacEfModule: OrganModule = {
  id: 'cardiac-ef',
  title: 'Фракция выброса',
  defaultQuestion: 'Оценить фракцию выброса левого желудочка.',
  requiredViews: ['end-diastole', 'end-systole'],
  qualityThreshold: 0.75,
  requiresSpatialScale: true,
  guidance: [
    {
      view: 'end-diastole',
      title: 'Конец диастолы',
      text: 'Отметьте контур эндокарда на кадре конца диастолы. Для метода дисков нужно не меньше 8 точек. Две-три точки остаются ориентирами и не становятся объёмом.',
    },
    {
      view: 'end-systole',
      title: 'Конец систолы',
      text: 'Повторите контур на кадре конца систолы. При двух плоскостях (A4C и A2C) объём считается по биплановому Симпсону.',
    },
  ],
  isFrameAcceptable: (frame, score) => acceptByTechnicalQuality(cardiacEfModule, frame, score),
  computeMeasurement(request) {
    const manual = request.manual?.kind === 'cardiac-ef' ? request.manual : undefined
    if (manual?.edvMl !== undefined || manual?.esvMl !== undefined) {
      if (!hasMeasurementScale(request.calibration)) {
        return measurementBase('cardiac-ef', request.calibration, {
          reason: 'EDV/ESV без подтверждённой шкалы не переводятся в проценты',
        })
      }
      if (manual.edvMl === undefined || manual.esvMl === undefined) {
        return measurementBase('cardiac-ef', request.calibration, { reason: 'нужны и EDV, и ESV' })
      }
      try {
        const ef = computeEF(manual.edvMl, manual.esvMl)
        return measurementBase(
          'cardiac-ef',
          request.calibration,
          { edvMl: manual.edvMl, esvMl: manual.esvMl, method: 'entered-volumes' },
          ef,
          'percent',
        )
      } catch (error) {
        return measurementBase('cardiac-ef', request.calibration, {
          reason: error instanceof Error ? error.message : 'объёмы отклонены',
        })
      }
    }
    if (!hasPixelScale(request.calibration)) {
      return measurementBase('cardiac-ef', request.calibration, {
        reason: 'для контура нужен PixelSpacing; 2–3 точки не заменяют объём',
      })
    }
    const mm = request.calibration.mmPerPixel
    const edA4 = volumeFromContour(manual?.a4cDiastole, mm)
    const esA4 = volumeFromContour(manual?.a4cSystole, mm)
    const edA2 = volumeFromContour(manual?.a2cDiastole, mm)
    const esA2 = volumeFromContour(manual?.a2cSystole, mm)
    try {
      if (edA4 !== null && esA4 !== null && edA2 !== null && esA2 !== null && manual) {
        const edDisks = diametersFromContour(manual.a4cDiastole ?? [])
        const esDisks = diametersFromContour(manual.a4cSystole ?? [])
        const edDisksB = diametersFromContour(manual.a2cDiastole ?? [])
        const esDisksB = diametersFromContour(manual.a2cSystole ?? [])
        if (!edDisks || !esDisks || !edDisksB || !esDisksB) {
          return measurementBase('cardiac-ef', request.calibration, { reason: 'контур не дал дисков Симпсона' })
        }
        const pair = (a: number[], b: number[]) => {
          const n = Math.min(a.length, b.length)
          return [a.slice(0, n), b.slice(0, n)] as const
        }
        const edPair = pair(edDisks.diametersPx, edDisksB.diametersPx)
        const esPair = pair(esDisks.diametersPx, esDisksB.diametersPx)
        const edvMl = simpsonBiplaneVolumeMl(
          edPair[0].map((px) => px * mm),
          edPair[1].map((px) => px * mm),
          ((edDisks.sliceHeightPx + edDisksB.sliceHeightPx) / 2) * mm,
        )
        const esvMl = simpsonBiplaneVolumeMl(
          esPair[0].map((px) => px * mm),
          esPair[1].map((px) => px * mm),
          ((esDisks.sliceHeightPx + esDisksB.sliceHeightPx) / 2) * mm,
        )
        return measurementBase(
          'cardiac-ef',
          request.calibration,
          { edvMl, esvMl, method: manual.contourSource === 'model' ? 'simpson-biplane-model' : 'simpson-biplane' },
          computeEF(edvMl, esvMl),
          'percent',
        )
      }
      if (edA4 !== null && esA4 !== null) {
        return measurementBase(
          'cardiac-ef',
          request.calibration,
          { edvMl: edA4, esvMl: esA4, method: manual?.contourSource === 'model' ? 'simpson-single-plane-model' : 'simpson-single-plane' },
          computeEF(edA4, esA4),
          'percent',
        )
      }
    } catch (error) {
      return measurementBase('cardiac-ef', request.calibration, {
        reason: error instanceof Error ? error.message : 'Симпсон не сошёлся',
      })
    }
    return measurementBase('cardiac-ef', request.calibration, {
      reason: 'нужны контуры конца диастолы и систолы минимум из 8 точек либо пара EDV/ESV',
    })
  },
  toFindingsPayload(result) {
    return {
      ejection_fraction_percent: result.value ?? null,
      edv_ml: result.raw.edvMl ?? null,
      esv_ml: result.raw.esvMl ?? null,
      method: result.raw.method ?? null,
      calibration: result.calibration,
      formulaSource: result.formulaSource,
      clinicallyValidated: result.clinicallyValidated,
      reason: result.raw.reason ?? null,
    }
  },
}
