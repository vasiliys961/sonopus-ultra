import type { DiagnosticOutcome, DiagnosisPriority, Polarity } from '@/lib/domain/types'

export const OUTCOME_LABEL: Record<DiagnosticOutcome, string> = {
  hypotheses_available: 'Есть предварительные гипотезы',
  low_confidence_hypothesis: 'Гипотеза ограниченной достоверности',
  insufficient_evidence: 'Недостаточно данных',
  unsupported_mode: 'Режим не поддерживается',
  error: 'Разбор не выполнен',
}

export const PRIORITY_LABEL: Record<DiagnosisPriority, string> = {
  consider: 'Рассмотреть',
  important_to_exclude: 'Важно исключить',
  most_compatible: 'Наиболее совместимо',
}

export const POLARITY_LABEL: Record<Polarity, string> = {
  present: 'есть',
  absent: 'нет',
  uncertain: 'неясно',
  not_assessed: 'не оценивалось',
}

export const VIEW_LABEL: Record<string, string> = {
  transverse: 'Поперечная',
  longitudinal: 'Продольная',
  'longitudinal-ivc': 'Продольная НПВ',
  RUQ: 'Правое подреберье',
  LUQ: 'Левое подреберье',
  pelvis: 'Таз',
  subxiphoid: 'Подмечевидная',
  'right-upper': 'Правая верхняя',
  'right-lower': 'Правая нижняя',
  'left-upper': 'Левая верхняя',
  'left-lower': 'Левая нижняя',
  'right-lobe': 'Правая доля',
  'left-lobe': 'Левая доля',
  'end-diastole': 'Конец диастолы',
  'end-systole': 'Конец систолы',
}
