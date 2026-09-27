import { assertPositive } from '@/lib/domain/number'

/** Индекс коллапсибельности НПВ: (Dmax − Dmin) / Dmax. Шкала сокращается, абсолютные мм не нужны. */
export function computeCollapsibilityIndex(diameters: number[]): number {
  if (diameters.length < 2) {
    throw new Error('для индекса нужна серия хотя бы из двух диаметров')
  }
  for (const diameter of diameters) assertPositive(diameter, 'diameter')
  const dMax = Math.max(...diameters)
  const dMin = Math.min(...diameters)
  if (dMax <= 0) throw new Error('Dmax должен быть больше нуля')
  return (dMax - dMin) / dMax
}

/**
 * Самый длинный анэхогенный промежуток строки, по краям которого стенка ярче просвета.
 * Возвращает ширину в пикселях.
 */
export function estimateAnechoicDiameterPx(
  gray: Float32Array,
  width: number,
  height: number,
  row: number,
): number | null {
  if (width < 5 || height < 1 || gray.length !== width * height) return null
  const y = Math.floor(row)
  if (y < 0 || y >= height) return null
  const lumen = 0.22
  const wall = 0.45
  let best = 0
  let run = 0
  let runStart = 0
  const line = y * width
  const closeRun = (endExclusive: number) => {
    if (run < 2) return
    const leftIndex = Math.max(0, runStart - 1)
    const rightIndex = Math.min(width - 1, endExclusive)
    const left = gray[line + leftIndex] ?? 1
    const right = gray[line + rightIndex] ?? 1
    if (left >= wall && right >= wall && run > best) best = run
  }
  for (let x = 0; x < width; x += 1) {
    const value = gray[line + x] ?? 1
    if (value <= lumen) {
      if (run === 0) runStart = x
      run += 1
    } else {
      closeRun(x)
      run = 0
    }
  }
  closeRun(width - 1)
  return best > 0 ? best : null
}
