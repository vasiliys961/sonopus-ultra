function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function evenString(value: string, pad: number): Uint8Array {
  const bytes = Array.from(value, (char) => char.charCodeAt(0))
  if (bytes.length % 2 === 1) bytes.push(pad)
  return Uint8Array.from(bytes)
}

function explicit(group: number, element: number, vr: string, value: Uint8Array): Uint8Array {
  const header = new Uint8Array(8)
  const view = new DataView(header.buffer)
  view.setUint16(0, group, true)
  view.setUint16(2, element, true)
  header[4] = vr.charCodeAt(0)
  header[5] = vr.charCodeAt(1)
  view.setUint16(6, value.length, true)
  return concat([header, value])
}

function explicitBulk(group: number, element: number, vr: string, value: Uint8Array): Uint8Array {
  const header = new Uint8Array(12)
  const view = new DataView(header.buffer)
  view.setUint16(0, group, true)
  view.setUint16(2, element, true)
  header[4] = vr.charCodeAt(0)
  header[5] = vr.charCodeAt(1)
  view.setUint32(8, value.length, true)
  return concat([header, value])
}

function explicitNumber(group: number, element: number, value: number): Uint8Array {
  const body = new Uint8Array(2)
  new DataView(body.buffer).setUint16(0, value, true)
  return explicit(group, element, 'US', body)
}

/** Несколько несжатых серых кадров в одном файле. Нужен проверке серии, не клинический файл. */
export function buildGraySeries(modality: string, frames: readonly Uint8Array[], width: number, height: number): Uint8Array {
  const pixels = concat([...frames])
  const transfer = explicit(0x0002, 0x0010, 'UI', evenString('1.2.840.10008.1.2.1', 0))
  const groupLength = new Uint8Array(4)
  new DataView(groupLength.buffer).setUint32(0, transfer.length, true)
  const metaLength = explicit(0x0002, 0x0000, 'UL', groupLength)
  const body = concat([
    explicit(0x0008, 0x0060, 'CS', evenString(modality, 0x20)),
    explicit(0x0028, 0x0004, 'CS', evenString('MONOCHROME2', 0x20)),
    explicit(0x0028, 0x0008, 'IS', evenString(String(frames.length), 0x20)),
    explicit(0x0018, 0x0088, 'DS', evenString('1.5', 0x20)),
    explicitNumber(0x0028, 0x0010, height),
    explicitNumber(0x0028, 0x0011, width),
    explicitNumber(0x0028, 0x0100, 8),
    explicitNumber(0x0028, 0x0101, 8),
    explicitNumber(0x0028, 0x0102, 7),
    explicitNumber(0x0028, 0x0103, 0),
    explicitNumber(0x0028, 0x0002, 1),
    explicitBulk(0x7fe0, 0x0010, 'OB', pixels),
  ])
  const preamble = new Uint8Array(128)
  const magic = Uint8Array.from([68, 73, 67, 77])
  return concat([preamble, magic, metaLength, transfer, body])
}

/** Маленький несжатый серый снимок. Нужен проверке чтения, не клинический файл. */
export function buildGrayDicom(modality: string, pixels: Uint8Array, width: number, height: number): Uint8Array {
  const transfer = explicit(0x0002, 0x0010, 'UI', evenString('1.2.840.10008.1.2.1', 0))
  const groupLength = new Uint8Array(4)
  new DataView(groupLength.buffer).setUint32(0, transfer.length, true)
  const metaLength = explicit(0x0002, 0x0000, 'UL', groupLength)
  const body = concat([
    explicit(0x0008, 0x0060, 'CS', evenString(modality, 0x20)),
    explicit(0x0028, 0x0004, 'CS', evenString('MONOCHROME2', 0x20)),
    explicitNumber(0x0028, 0x0010, height),
    explicitNumber(0x0028, 0x0011, width),
    explicitNumber(0x0028, 0x0100, 8),
    explicitNumber(0x0028, 0x0101, 8),
    explicitNumber(0x0028, 0x0102, 7),
    explicitNumber(0x0028, 0x0103, 0),
    explicitNumber(0x0028, 0x0002, 1),
    explicitBulk(0x7fe0, 0x0010, 'OB', pixels),
  ])
  const preamble = new Uint8Array(128)
  const magic = Uint8Array.from([68, 73, 67, 77])
  return concat([preamble, magic, metaLength, transfer, body])
}

/** Минимальный DICOM Explicit VR Little Endian с заданным PixelSpacing. */
export function buildPixelSpacingDicom(rowMm: number, columnMm: number, modality = 'US'): Uint8Array {
  const transfer = explicit(0x0002, 0x0010, 'UI', evenString('1.2.840.10008.1.2.1', 0))
  const groupLength = new Uint8Array(4)
  new DataView(groupLength.buffer).setUint32(0, transfer.length, true)
  const metaLength = explicit(0x0002, 0x0000, 'UL', groupLength)
  const pixelSpacing = explicit(0x0028, 0x0030, 'DS', evenString(`${rowMm}\\${columnMm}`, 0x20))
  const modalityElement = explicit(0x0008, 0x0060, 'CS', evenString(modality, 0x20))
  const preamble = new Uint8Array(128)
  const magic = Uint8Array.from([68, 73, 67, 77])
  return concat([preamble, magic, metaLength, transfer, modalityElement, pixelSpacing])
}
