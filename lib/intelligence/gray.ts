export interface GrayPlane {
  gray: Float32Array
  width: number
  height: number
}

/** Ужимает кадр до длинной стороны maxEdge. В объём идёт уже эта сетка, не полный кадр видео. */
export function fitGray(source: Float32Array, width: number, height: number, maxEdge = 56): GrayPlane {
  const edge = Math.max(width, height)
  if (edge <= maxEdge) return { gray: source, width, height }
  const scale = maxEdge / edge
  const nextWidth = Math.max(8, Math.round(width * scale))
  const nextHeight = Math.max(8, Math.round(height * scale))
  const gray = new Float32Array(nextWidth * nextHeight)
  for (let y = 0; y < nextHeight; y += 1) {
    const y0 = Math.floor((y * height) / nextHeight)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / nextHeight))
    for (let x = 0; x < nextWidth; x += 1) {
      const x0 = Math.floor((x * width) / nextWidth)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / nextWidth))
      let sum = 0
      let count = 0
      for (let yy = y0; yy < y1 && yy < height; yy += 1) {
        for (let xx = x0; xx < x1 && xx < width; xx += 1) {
          sum += source[yy * width + xx] ?? 0
          count += 1
        }
      }
      gray[y * nextWidth + x] = count === 0 ? 0 : sum / count
    }
  }
  return { gray, width: nextWidth, height: nextHeight }
}

export function planeDiff(left: GrayPlane, right: GrayPlane): number {
  const width = Math.min(left.width, right.width)
  const height = Math.min(left.height, right.height)
  if (width === 0 || height === 0) return 1
  let sum = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      sum += Math.abs((left.gray[y * left.width + x] ?? 0) - (right.gray[y * right.width + x] ?? 0))
      count += 1
    }
  }
  return count === 0 ? 1 : sum / count
}

export interface ShiftMatch {
  dx: number
  dy: number
  similarity: number
}

/** Сдвиг второй картинки относительно первой. Ищет только в плоскости кадра. */
export function matchShift(left: GrayPlane, right: GrayPlane, radius = 4): ShiftMatch {
  const width = Math.min(left.width, right.width)
  const height = Math.min(left.height, right.height)
  let bestDx = 0
  let bestDy = 0
  let best = Number.POSITIVE_INFINITY
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      let sum = 0
      let count = 0
      for (let y = 0; y < height; y += 1) {
        const y2 = y + dy
        if (y2 < 0 || y2 >= right.height) continue
        for (let x = 0; x < width; x += 1) {
          const x2 = x + dx
          if (x2 < 0 || x2 >= right.width) continue
          sum += Math.abs((left.gray[y * left.width + x] ?? 0) - (right.gray[y2 * right.width + x2] ?? 0))
          count += 1
        }
      }
      if (count < 8) continue
      const mean = sum / count
      if (mean < best) {
        best = mean
        bestDx = dx
        bestDy = dy
      }
    }
  }
  return {
    dx: bestDx,
    dy: bestDy,
    similarity: Number.isFinite(best) ? Math.max(0, Math.min(1, 1 - best)) : 0,
  }
}
