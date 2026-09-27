export function parseKeepIds(text: string, allowed: ReadonlySet<string>, limit: number): string[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return []
  try {
    const body = JSON.parse(match[0]) as { keep?: unknown }
    if (!Array.isArray(body.keep)) return []
    const ids = body.keep.filter((item): item is string => typeof item === 'string' && allowed.has(item))
    return [...new Set(ids)].slice(0, limit)
  } catch {
    return []
  }
}

export function pickPrompt(organ: string, ids: string[], limit: number): string {
  return [
    `Область исследования: ${organ}.`,
    `Кадры по порядку, id: ${ids.join(', ')}.`,
    `Оставь те, где эта область видна достаточно, чтобы её описывать.`,
    `Верни только JSON {"keep":["id"]}. Не больше ${limit}. Не выдумывай id.`,
  ].join(' ')
}
