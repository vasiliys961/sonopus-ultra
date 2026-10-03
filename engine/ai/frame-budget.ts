export interface AIFrameBudget {
  minimum: number
  maximum: number
  priority: string[]
}

/**
 * Бюджет будущего вызова модели. Реконструкция его не использует:
 * в объём уже ушла более плотная петля.
 */
export function aiFrameBudget(frameIds: readonly string[], priorityIds: readonly string[], maximum = 24): AIFrameBudget {
  const priority = new Set<string>()
  for (const id of priorityIds) {
    const index = frameIds.indexOf(id)
    if (index < 0) continue
    for (let cursor = Math.max(0, index - 1); cursor <= Math.min(frameIds.length - 1, index + 1); cursor += 1) {
      const neighbor = frameIds[cursor]
      if (neighbor) priority.add(neighbor)
    }
  }
  if (priority.size === 0) {
    const stride = Math.max(1, Math.ceil(frameIds.length / maximum))
    for (let index = 0; index < frameIds.length && priority.size < maximum; index += stride) {
      const id = frameIds[index]
      if (id) priority.add(id)
    }
  }
  const picked = [...priority].slice(0, maximum)
  return {
    minimum: Math.min(4, frameIds.length),
    maximum,
    priority: picked,
  }
}
