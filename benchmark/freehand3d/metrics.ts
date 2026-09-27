export function translationMaeMm(predictedMm: number, truthMm: number): number {
  return Math.abs(predictedMm - truthMm)
}

export const SYNTHETIC_SHIFTS = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4] as const
export const CONTROLLED_SHIFTS = SYNTHETIC_SHIFTS
