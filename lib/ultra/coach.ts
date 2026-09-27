import type { QualityScore } from '@/lib/domain/types'
import type { Locale } from '@/lib/i18n/locales'
import { COACH_PHRASE, HEART_LINE } from '@/lib/ultra/coach-phrases'

export function coachLine(input: {
  score: QualityScore | null
  moduleId: string
  elapsedMs: number
  locale: Locale
}): string {
  const { score, moduleId, elapsedMs, locale } = input
  if (score && score.stability < 0.45) return COACH_PHRASE.steady[locale]
  if (score && score.sharpness < 0.45) return COACH_PHRASE.soft[locale]
  if (score && score.brightness < 0.45) return COACH_PHRASE.bright[locale]
  if (moduleId === 'ivc') return COACH_PHRASE.ivc[locale]
  if (moduleId === 'cardiac-ef') {
    const lines = HEART_LINE[locale]
    const index = Math.min(lines.length - 1, Math.max(0, Math.floor(elapsedMs / 8000)))
    return lines[index]
  }
  if (moduleId === 'multi-angle') return COACH_PHRASE.multi[locale]
  return COACH_PHRASE.sweep[locale]
}

const TECHNICAL = /LLM|DICOM|Pixel|JSON|TUS|POSE|Brain|schema|провайдер|модул|API/i

export function plainFailure(message: string, locale: Locale): string {
  if (TECHNICAL.test(message) || /не прошёл проверку|не JSON|сбой разбора/.test(message)) {
    return COACH_PHRASE.failReview[locale]
  }
  return COACH_PHRASE.failRepeat[locale]
}

const REWRITE: Array<[RegExp, keyof typeof COACH_PHRASE]> = [
  [/порога качества/, 'rewriteQuality'],
  [/не подтверждена/, 'rewriteArea'],
  [/без привязки к кадру/, 'rewriteFrames'],
]

export function doctorLine(message: string, locale: Locale): string | null {
  if (TECHNICAL.test(message) || /не прошёл проверку|не JSON|сбой разбора|не настроен|провайдер/.test(message)) return null
  for (const [pattern, key] of REWRITE) {
    if (pattern.test(message)) return COACH_PHRASE[key][locale]
  }
  return message
}
