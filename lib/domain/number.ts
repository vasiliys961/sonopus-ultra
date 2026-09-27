export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name}: ожидается конечное число`)
  }
}

export function assertPositive(value: number, name: string): void {
  assertFinite(value, name)
  if (value <= 0) {
    throw new Error(`${name}: ожидается число больше нуля`)
  }
}

export function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name)
  if (value < 0) {
    throw new Error(`${name}: ожидается неотрицательное число`)
  }
}

/** Верхняя граница линейного размера мягких тканей в мм для ручного ввода. */
export const MAX_DIMENSION_MM = 250

export function assertDimensionMm(value: number, name: string): void {
  assertPositive(value, name)
  if (value > MAX_DIMENSION_MM) {
    throw new Error(`${name}: размер ${value} мм выходит за границу ${MAX_DIMENSION_MM} мм`)
  }
}
