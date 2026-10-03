import { fuseVolumes } from '@/engine/hybrid/fusion'
import { affineRegistration, deformableRegistration } from '@/engine/registration/rigid'
import { temporalConsistency } from '@/engine/temporal/consistency'
import type { ArtifactNote, LesionCandidate } from '@/types/pathology'
import type { AnatomyNode, StructuredReport } from '@/types/study'
import type { TemporalSummary } from '@/types/temporal-ultrasound'

export function structuredReport(input: {
  accepted: number
  coverage: number
  note: string
  temporal: TemporalSummary
  anatomy: readonly AnatomyNode[]
  candidates: readonly LesionCandidate[]
  artifacts: readonly ArtifactNote[]
  dataStatus: 'OK' | 'INSUFFICIENT DATA'
  resampled?: boolean
  organTitle?: string
  probe?: { lateral: number; depth: number }
}): StructuredReport {
  const examination = [
    'Модальность: ультразвук, пространственный эскиз прохода.',
    `Область атласа: ${input.organTitle ?? 'печень'}. На картине не подтверждена.`,
    `Принято срезов: ${input.accepted}. Покрытие сетки: ${Math.round(input.coverage * 100)}%.`,
    'Шкала миллиметров пациента не подтверждена.',
    ...(input.resampled ? ['Вокруг кандидата кадры взяты плотнее.'] : []),
    ...(input.candidates.length > 0 ? ['Ткань описана только относительной яркостью эхо.'] : []),
    `Временная согласованность соседних срезов: ${temporalConsistency(input.temporal).toFixed(2)}. Это не трекинг датчика.`,
    `Оценка хода датчика по картинке: в плоскости ${input.probe?.lateral.toFixed(1) ?? '0.0'}, по глубине ${input.probe?.depth.toFixed(1) ?? '0.0'}. Единицы сетки, не датчик положения.`,
  ]
  const anatomy = input.anatomy.map((node) => `${node.name}: атлас, на картине не подтверждено.`)
  const findings = input.candidates.length === 0
    ? ['Отдельного очага по порогу яркости не выделено.']
    : input.candidates.map((item) => `${item.echogenicity}, вокселей ${item.voxelCount}, общая уверенность ${item.provenance.confidence.overall.toFixed(2)}. На ${item.hold.sameSign} из ${item.hold.matched} сопоставленных кадров знак яркости тот же. Это не трекинг. Это кандидат, не диагноз.`)
  const candidates = input.candidates.map((item) => {
    const frames = item.provenance.frames.length > 0 ? item.provenance.frames.join(', ') : 'кадры не сопоставлены'
    return `${item.id}: ${item.kind}, источник ${item.provenance.source}, кадры ${frames}.`
  })
  const limitations = [
    input.note,
    'Поза VIDEO_ESTIMATION: глубина оценена по смене картинки, не трекером.',
    'Клинически не проверено.',
  ]
  if (input.temporal.stable) limitations.push('Картинка по ходу почти стабильна, объём может быть плоским.')
  if (input.dataStatus === 'INSUFFICIENT DATA') limitations.push('INSUFFICIENT DATA: для вывода о очаге данных мало.')
  for (const artifact of input.artifacts) limitations.push(`Артефакт не стал кандидатом: ${artifact.label}.`)
  if (!input.anatomy.some((node) => node.observed)) limitations.push('Структуры печени взяты из атласа и не отмечены как увиденные.')
  limitations.push(affineRegistration().reason)
  limitations.push(deformableRegistration().reason)
  limitations.push(fuseVolumes().reason)
  const conclusion = input.dataStatus === 'INSUFFICIENT DATA'
    ? 'Заключение не формируется: данных для очага недостаточно. Диагноз не поставлен.'
    : input.candidates.length === 0
      ? 'На эскизе нет кандидата по яркости. Диагноз не поставлен. Это не заключение «патологии нет».'
      : `Найдено кандидатов: ${input.candidates.length}. Диагноз не поставлен.`
  return { examination, anatomy, findings, candidates, limitations, conclusion }
}
