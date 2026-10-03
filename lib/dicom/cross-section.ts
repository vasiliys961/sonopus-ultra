import dicomParser from 'dicom-parser'

export interface CrossSection {
  modality: 'MR' | 'CT' | 'US' | 'OTHER'
  width: number
  height: number
  gray: Float32Array
  spacingMm: [number, number] | null
}

export interface CrossSeries {
  modality: CrossSection['modality']
  width: number
  height: number
  frames: Float32Array[]
  spacingMm: [number, number] | null
  /** Шаг между кадрами, если он записан в файле. Иначе null: это не миллиметры пациента. */
  sliceStepMm: number | null
}

const UNCOMPRESSED = new Set(['1.2.840.10008.1.2.1', '1.2.840.10008.1.2'])

/** Несжатый серый снимок. Сжатый трансфер не декодируется. Яркость растянута для показа, это не шкала пациента. */
export function readCrossSection(bytes: Uint8Array): { section: CrossSection | null; reason: string | null } {
  let dataSet: dicomParser.DataSet
  try {
    dataSet = dicomParser.parseDicom(bytes)
  } catch {
    return { section: null, reason: 'файл не разбирается как DICOM' }
  }
  const transfer = (dataSet.string('x00020010') ?? '').replace(/\0/g, '').trim()
  if (transfer && !UNCOMPRESSED.has(transfer)) {
    return { section: null, reason: 'сжатый DICOM этим просмотром не читается' }
  }
  const width = dataSet.uint16('x00280011') ?? 0
  const height = dataSet.uint16('x00280010') ?? 0
  const bits = dataSet.uint16('x00280100') ?? 0
  const samples = dataSet.uint16('x00280002') ?? 1
  const pixel = dataSet.elements.x7fe00010
  if (!pixel || width < 1 || height < 1 || samples !== 1 || (bits !== 8 && bits !== 16)) {
    return { section: null, reason: 'в файле нет несжатого серого снимка' }
  }
  const raw = dataSet.byteArray.subarray(pixel.dataOffset, pixel.dataOffset + pixel.length)
  const count = width * height
  const gray = new Float32Array(count)
  if (bits === 8) {
    for (let index = 0; index < count; index += 1) gray[index] = raw[index] ?? 0
  } else {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    for (let index = 0; index < count; index += 1) gray[index] = view.getUint16(index * 2, true)
  }
  let min = Infinity
  let max = -Infinity
  for (const value of gray) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  const span = max - min
  if (span > 0) {
    for (let index = 0; index < gray.length; index += 1) gray[index] = ((gray[index] ?? 0) - min) / span
  } else {
    gray.fill(0)
  }
  if ((dataSet.string('x00280004') ?? '').trim() === 'MONOCHROME1') {
    for (let index = 0; index < gray.length; index += 1) gray[index] = 1 - (gray[index] ?? 0)
  }
  const spacing = parseSpacing(dataSet.string('x00280030'))
  return {
    section: { modality: modalityOf(dataSet.string('x00080060')), width, height, gray, spacingMm: spacing },
    reason: null,
  }
}

/** Один файл с несколькими кадрами или несколько файлов одного размера. Порядок файлов сохраняется. Совмещение не делается. */
export function readCrossSeries(parts: readonly Uint8Array[]): { series: CrossSeries | null; reason: string | null } {
  if (parts.length === 0) return { series: null, reason: 'файлы не выбраны' }
  const frames: Float32Array[] = []
  let series: CrossSeries | null = null
  for (const bytes of parts) {
    const read = readFrames(bytes)
    if (!read.frames) return { series: null, reason: read.reason }
    if (!series) {
      series = {
        modality: read.modality,
        width: read.width,
        height: read.height,
        frames,
        spacingMm: read.spacingMm,
        sliceStepMm: read.sliceStepMm,
      }
    } else if (read.width !== series.width || read.height !== series.height || read.modality !== series.modality) {
      return { series: null, reason: 'кадры разного размера или модальности' }
    }
    frames.push(...read.frames)
  }
  if (!series || frames.length === 0) return { series: null, reason: 'в файле нет несжатого серого снимка' }
  return { series, reason: null }
}

function readFrames(bytes: Uint8Array): {
  frames: Float32Array[] | null
  reason: string | null
  modality: CrossSection['modality']
  width: number
  height: number
  spacingMm: [number, number] | null
  sliceStepMm: number | null
} {
  const empty = { frames: null, reason: 'файл не разбирается как DICOM', modality: 'OTHER' as const, width: 0, height: 0, spacingMm: null, sliceStepMm: null }
  let dataSet: dicomParser.DataSet
  try {
    dataSet = dicomParser.parseDicom(bytes)
  } catch {
    return empty
  }
  const transfer = (dataSet.string('x00020010') ?? '').replace(/\0/g, '').trim()
  if (transfer && !UNCOMPRESSED.has(transfer)) {
    return { ...empty, reason: 'сжатый DICOM этим просмотром не читается' }
  }
  const width = dataSet.uint16('x00280011') ?? 0
  const height = dataSet.uint16('x00280010') ?? 0
  const bits = dataSet.uint16('x00280100') ?? 0
  const samples = dataSet.uint16('x00280002') ?? 1
  const pixel = dataSet.elements.x7fe00010
  const count = width * height
  const declared = Math.max(1, Math.round(Number((dataSet.string('x00280008') ?? '').replace(/\0/g, '').trim()) || 1))
  if (!pixel || count < 1 || samples !== 1 || (bits !== 8 && bits !== 16)) {
    return { ...empty, reason: 'в файле нет несжатого серого снимка' }
  }
  const bytesPerFrame = bits === 8 ? count : count * 2
  if (pixel.length < declared * bytesPerFrame) {
    return { ...empty, reason: 'в файле нет несжатого серого снимка' }
  }
  const frames: Float32Array[] = []
  const invert = (dataSet.string('x00280004') ?? '').trim() === 'MONOCHROME1'
  for (let frame = 0; frame < declared; frame += 1) {
    const start = pixel.dataOffset + frame * bytesPerFrame
    const raw = dataSet.byteArray.subarray(start, start + bytesPerFrame)
    frames.push(stretch(decodeGray(raw, count, bits), invert))
  }
  return {
    frames,
    reason: null,
    modality: modalityOf(dataSet.string('x00080060')),
    width,
    height,
    spacingMm: parseSpacing(dataSet.string('x00280030')),
    sliceStepMm: positiveNumber(dataSet.string('x00180088') ?? dataSet.string('x00180050')),
  }
}

function decodeGray(raw: Uint8Array, count: number, bits: number): Float32Array {
  const gray = new Float32Array(count)
  if (bits === 8) {
    for (let index = 0; index < count; index += 1) gray[index] = raw[index] ?? 0
    return gray
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  for (let index = 0; index < count; index += 1) gray[index] = view.getUint16(index * 2, true)
  return gray
}

function stretch(gray: Float32Array, invert: boolean): Float32Array {
  let min = Infinity
  let max = -Infinity
  for (const value of gray) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  const span = max - min
  if (span > 0) {
    for (let index = 0; index < gray.length; index += 1) gray[index] = ((gray[index] ?? 0) - min) / span
  } else {
    gray.fill(0)
  }
  if (invert) {
    for (let index = 0; index < gray.length; index += 1) gray[index] = 1 - (gray[index] ?? 0)
  }
  return gray
}

function positiveNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const value = Number(raw.split('\\')[0]?.trim())
  return Number.isFinite(value) && value > 0 ? value : null
}

function modalityOf(raw: string | undefined): CrossSection['modality'] {
  const value = (raw ?? '').trim()
  if (value === 'MR' || value === 'CT' || value === 'US') return value
  return 'OTHER'
}

function parseSpacing(raw: string | undefined): [number, number] | null {
  if (!raw) return null
  const parts = raw.split('\\').map((item) => Number(item.trim()))
  if (parts.length < 2 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null
  return [parts[0] ?? 0, parts[1] ?? 0]
}
