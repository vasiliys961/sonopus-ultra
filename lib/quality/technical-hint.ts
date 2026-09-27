import type { QualityScore } from '@/lib/domain/types'

const HINTS: Array<{ key: keyof Pick<QualityScore, 'sharpness' | 'brightness' | 'stability' | 'coverage'>; text: string }> = [
  { key: 'sharpness', text: 'Кадр нерезкий.' },
  { key: 'brightness', text: 'Кадр слишком тёмный или пересвечен.' },
  { key: 'stability', text: 'Слишком резкое движение.' },
  { key: 'coverage', text: 'Полезный сигнал занимает слишком малую часть кадра.' },
]

/** Техническая подсказка. Не описывает анатомию и не советует, куда вести датчик. */
export function technicalHint(score: QualityScore): string {
  const worst = [...HINTS].sort((a, b) => score[a.key] - score[b.key])[0]
  return worst?.text ?? 'Качество кадра ниже порога.'
}
