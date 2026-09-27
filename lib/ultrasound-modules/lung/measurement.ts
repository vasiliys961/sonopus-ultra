/** Считает отдельные яркие вертикальные столбцы — грубая эвристика B-линий, не сегментация. */
export function countVerticalBrightLines(gray: Float32Array, width: number, height: number): number {
  if (width < 5 || height < 8 || gray.length !== width * height) return 0
  const y0 = Math.floor(height * 0.2)
  const y1 = Math.floor(height * 0.9)
  const span = Math.max(1, y1 - y0)
  const columnScore = new Float32Array(width)
  for (let x = 0; x < width; x += 1) {
    let bright = 0
    for (let y = y0; y < y1; y += 1) {
      if ((gray[y * width + x] ?? 0) > 0.72) bright += 1
    }
    columnScore[x] = bright / span
  }
  const flagged = new Array<boolean>(width).fill(false)
  for (let x = 2; x < width - 2; x += 1) {
    const neighbors = ((columnScore[x - 2] ?? 0) + (columnScore[x + 2] ?? 0)) / 2
    flagged[x] = (columnScore[x] ?? 0) > 0.55 && (columnScore[x] ?? 0) > neighbors + 0.25
  }
  let count = 0
  let inRun = false
  for (let x = 0; x < width; x += 1) {
    if (flagged[x] && !inRun) {
      count += 1
      inRun = true
    } else if (!flagged[x]) inRun = false
  }
  return count
}
