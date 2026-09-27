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
