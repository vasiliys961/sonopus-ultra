const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes: ArrayLike<number>): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0
    const c = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0
    const triple = (a << 16) | (b << 8) | c
    out += ALPHA[(triple >> 18) & 63]
    out += ALPHA[(triple >> 12) & 63]
    out += i + 1 < bytes.length ? ALPHA[(triple >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ALPHA[triple & 63] : '='
  }
  return out
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '')
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  const length = (clean.length / 4) * 3 - pad
  const out = new Uint8Array(length)
  let offset = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = ALPHA.indexOf(clean[i] ?? 'A')
    const b = ALPHA.indexOf(clean[i + 1] ?? 'A')
    const c = ALPHA.indexOf(clean[i + 2] ?? 'A')
    const d = ALPHA.indexOf(clean[i + 3] ?? 'A')
    const triple = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63)
    if (offset < length) out[offset] = (triple >> 16) & 255
    if (offset + 1 < length) out[offset + 1] = (triple >> 8) & 255
    if (offset + 2 < length) out[offset + 2] = triple & 255
    offset += 3
  }
  return out
}
