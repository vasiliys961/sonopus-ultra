import type { QualityScore } from '@/lib/domain/types'
import type { Locale } from '@/lib/i18n/copy'

const HEART = {
  ru: [
    'Парастернальная длинная ось. Покажите сердце вдоль.',
    'Парастернальная короткая ось. Поверните датчик.',
    'Апикальная четырёхкамерная. Наклоните датчик к верхушке.',
    'Апикальная двухкамерная. Поверните ещё и покажите конец расслабления и конец сокращения.',
  ],
  en: [
    'Parasternal long axis. Show the heart along its length.',
    'Parasternal short axis. Rotate the probe.',
    'Apical four-chamber. Tilt the probe toward the apex.',
    'Apical two-chamber. Rotate again and show end-relaxation and end-contraction.',
  ],
} as const

export function coachLine(input: {
  score: QualityScore | null
  moduleId: string
  elapsedMs: number
  locale: Locale
}): string {
  const { score, moduleId, elapsedMs, locale } = input
  const ru = locale === 'ru'
  if (score && score.stability < 0.45) {
    return ru ? 'Держите датчик спокойнее. Ведите медленнее.' : 'Hold the probe steadier. Sweep more slowly.'
  }
  if (score && score.sharpness < 0.45) {
    return ru ? 'Кадр нерезкий. Задержите датчик на месте.' : 'The picture is soft. Hold the probe still.'
  }
  if (score && score.brightness < 0.45) {
    return ru ? 'Кадр слишком тёмный или яркий. Поправьте усиление на аппарате.' : 'The picture is too dark or too bright. Adjust the gain on the machine.'
  }
  if (moduleId === 'ivc') {
    return ru ? 'Ослабьте нажатие. Сосуд сжимается.' : 'Press more lightly. The vessel is compressed.'
  }
  if (moduleId === 'cardiac-ef') {
    const lines = HEART[locale]
    const index = Math.min(lines.length - 1, Math.max(0, Math.floor(elapsedMs / 8000)))
    return lines[index]
  }
  if (moduleId === 'multi-angle') {
    return ru
      ? 'Поверните или наклоните датчик. 30, 45 и 60 градусов — ваш шаг, аппарат угол не измеряет.'
      : 'Rotate or tilt the probe. 30, 45 and 60 degrees are your step; the machine does not measure the angle.'
  }
  return ru ? 'Ведите датчик по области и держите картинку на экране.' : 'Sweep the probe across the area and keep the picture on the screen.'
}

const TECHNICAL = /LLM|DICOM|Pixel|JSON|TUS|POSE|Brain|schema|провайдер|модул|API/i

export function plainFailure(message: string, locale: Locale): string {
  if (TECHNICAL.test(message) || /не прошёл проверку|не JSON|сбой разбора/.test(message)) {
    return locale === 'ru'
      ? 'Заключение сейчас не написалось. Разбор не подключён.'
      : 'The conclusion could not be written. Review is not connected.'
  }
  return locale === 'ru'
    ? 'Заключение сейчас не написалось. Повторите проход.'
    : 'The conclusion could not be written. Repeat the pass.'
}

const REWRITE: Record<Locale, Array<[RegExp, string]>> = {
  ru: [
    [/порога качества/, 'Картинка слишком нечёткая. Повторите проход медленнее.'],
    [/не подтверждена/, 'Сначала выберите область.'],
    [/без привязки к кадру/, 'По этим кадрам заключение не собралось. Повторите проход.'],
  ],
  en: [
    [/порога качества/, 'The picture is too unclear. Sweep again, more slowly.'],
    [/не подтверждена/, 'Choose the area first.'],
    [/без привязки к кадру/, 'These frames did not produce a conclusion. Repeat the pass.'],
  ],
}

export function doctorLine(message: string, locale: Locale): string | null {
  if (TECHNICAL.test(message) || /не прошёл проверку|не JSON|сбой разбора|не настроен|провайдер/.test(message)) return null
  for (const [pattern, line] of REWRITE[locale]) {
    if (pattern.test(message)) return line
  }
  return message
}
