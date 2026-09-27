import dicomParser from 'dicom-parser'

export interface DicomInspection {
  pixelSpacingMm: [number, number] | null
  mmPerPixel: number | null
  calibration: 'verified' | 'unavailable'
  modality: string | null
  reason?: string
}

function parseSpacing(raw: string | undefined): [number, number] | null {
  if (!raw) return null
  const parts = raw.split('\\').map((item) => Number(item.trim()))
  if (parts.length < 2 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null
  return [parts[0], parts[1]]
}

export function inspectDicomBuffer(bytes: Uint8Array): DicomInspection {
  let dataSet: dicomParser.DataSet
  try {
    dataSet = dicomParser.parseDicom(bytes)
  } catch {
    return {
      pixelSpacingMm: null,
      mmPerPixel: null,
      calibration: 'unavailable',
      modality: null,
      reason: 'файл не разбирается как DICOM',
    }
  }
  const modality = dataSet.string('x00080060') ?? null
  const spacing = parseSpacing(dataSet.string('x00280030'))
  if (!spacing) {
    return {
      pixelSpacingMm: null,
      mmPerPixel: null,
      calibration: 'unavailable',
      modality,
      reason: 'в файле нет пригодного PixelSpacing',
    }
  }
  const [row, column] = spacing
  const delta = Math.abs(row - column) / Math.max(row, column)
  if (delta > 0.02) {
    return {
      pixelSpacingMm: spacing,
      mmPerPixel: null,
      calibration: 'unavailable',
      modality,
      reason: 'PixelSpacing анизотропный, одна шкала для контура неприменима',
    }
  }
  return {
    pixelSpacingMm: spacing,
    mmPerPixel: (row + column) / 2,
    calibration: 'verified',
    modality,
  }
}
