import type { CandidateKind } from '@/types/pathology'

export interface EchoHold {
  matched: number
  sameSign: number
}

interface HoldFrame {
  id: string
  gray: Float32Array
  width: number
  height: number
}

/** Воксель объёма → пиксель кадра без хода датчика. Ход вычитается отдельно. */
export function slicePixel(
  originX: number,
  originY: number,
  spacingX: number,
  spacingY: number,
  voxelX: number,
  voxelY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const worldX = originX + voxelX * (spacingX || 1)
  const worldY = originY + voxelY * (spacingY || 1)
  return { x: worldX + width / 2 - 0.5, y: worldY + height / 2 - 0.5 }
}

/** Сколько сопоставленных кадров держат тот же знак яркости в окне точки. Это не трекинг. */
export function echoHold(
  kind: CandidateKind,
  x: number,
  y: number,
  frames: readonly HoldFrame[],
  ids: readonly string[],
  probe: ReadonlyMap<string, { x: number; y: number }> = new Map(),
): EchoHold {
  const byId = new Map(frames.map((frame) => [frame.id, frame]))
  let matched = 0
  let sameSign = 0
  for (const id of ids) {
    const frame = byId.get(id)
    if (!frame) continue
    const shift = probe.get(id)
    const local = windowMean(frame, x - (shift?.x ?? 0), y - (shift?.y ?? 0))
    if (local == null) continue
    matched += 1
    const overall = tissueMean(frame.gray)
    const darker = local + 0.04 < overall
    const brighter = local > overall + 0.04
    if ((kind === 'hypoechoic' && darker) || (kind === 'hyperechoic' && brighter)) sameSign += 1
  }
  return { matched, sameSign }
}

function windowMean(frame: HoldFrame, x: number, y: number): number | null {
  const col = Math.round(x)
  const row = Math.round(y)
  let sum = 0
  let count = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const yy = row + dy
      const xx = col + dx
      if (yy < 0 || xx < 0 || yy >= frame.height || xx >= frame.width) continue
      sum += frame.gray[yy * frame.width + xx] ?? 0
      count += 1
    }
  }
  return count === 0 ? null : sum / count
}

function tissueMean(gray: Float32Array): number {
  let tissue = 0
  let tissueCount = 0
  let sum = 0
  for (const value of gray) {
    sum += value
    if (value <= 0.04) continue
    tissue += value
    tissueCount += 1
  }
  if (tissueCount > 0) return tissue / tissueCount
  return gray.length === 0 ? 0 : sum / gray.length
}
