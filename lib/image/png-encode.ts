import { crc32, deflateSync } from 'node:zlib'
import type { Raster } from '@/lib/domain/types'

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const name = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0)
  return Buffer.concat([length, name, data, crc])
}

export function encodePng(raster: Raster): Buffer {
  const { width, height, data } = raster
  if (width < 1 || height < 1 || data.length < width * height * 4) {
    throw new Error('некорректный растр для PNG')
  }
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const dest = y * (width * 4 + 1)
    raw[dest] = 0
    const src = y * width * 4
    for (let i = 0; i < width * 4; i += 1) raw[dest + 1 + i] = data[src + i] ?? 0
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
