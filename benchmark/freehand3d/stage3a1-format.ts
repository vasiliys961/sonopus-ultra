import type { ReconstructionRecord, Stage3A1Report } from '@/benchmark/freehand3d/stage3a1'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'

function cell(value: MetricValue | number | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  return String(value ?? 'NOT AVAILABLE')
}

function surface(record: ReconstructionRecord): string {
  return cell(record.discreteSurface.reconstructionToGroundTruth.meanMm)
}

export function stage3a1Markdown(report: Stage3A1Report): string {
  const perfect = report.baselines.perfectPose
  const estimated = report.baselines.estimatedPose
  const voxel = report.baselines.voxelTruth
  const lines = [
    '# Stage 3A.1 — benchmark integrity',
    '',
    'Stage 3A.1 is a controlled synthetic reconstruction benchmark and is not clinical validation.',
    '',
    'Статус: EXPERIMENTAL. Клиническая валидация: нет. TUS-REC: NOT CONNECTED.',
    '',
    ...report.limitations.map((item) => `- ${item}`),
    '',
    '## Вопросы',
    '',
    `Q1. ${report.questions.q1}`,
    '',
    `Q2. ${report.questions.q2}`,
    '',
    `Q3. ${report.questions.q3}`,
    '',
    `Q4. ${report.questions.q4}`,
    '',
    `Q5. ${report.questions.q5}`,
    '',
    '## Три baseline',
    '',
    `Voxel truth: занято ${voxel.occupiedVoxels} вокселей, voxel volume ${cell(voxel.voxelVolumeMm3)} мм³, аналитический объём ${cell(voxel.analyticVolumeMm3)} мм³, расхождение ${cell(voxel.volumeDiscrepancyPercent)}%.`,
    '',
    '| | Dice | IoU | Surface GT←recon, мм | Объём vs voxel, % | Объём vs analytic, % | Кадры |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| Perfect pose | ${cell(perfect.dice)} | ${cell(perfect.iou)} | ${surface(perfect)} | ${cell(perfect.volumeErrorVsVoxelTruthPercent)} | ${cell(perfect.volumeErrorVsAnalyticTruthPercent)} | ${perfect.usedFrames} |`,
    `| Registration | ${cell(estimated.dice)} | ${cell(estimated.iou)} | ${surface(estimated)} | ${cell(estimated.volumeErrorVsVoxelTruthPercent)} | ${cell(estimated.volumeErrorVsAnalyticTruthPercent)} | ${estimated.usedFrames} |`,
    '',
    '## Поза регистрации',
    '',
    `| Local mean | ${cell(estimated.pose.local.meanTranslationMm)} мм |`,
    `| Local Z | ${cell(estimated.pose.local.translationZMm)} |`,
    `| Local rotation | ${cell(estimated.pose.local.rotationDeg)} |`,
    `| Global mean | ${cell(estimated.pose.global.meanTranslationMm)} мм |`,
    `| Global P95 | ${cell(estimated.pose.global.p95TranslationMm)} мм |`,
    `| Global max | ${cell(estimated.pose.global.maxTranslationMm)} мм |`,
    `| Drift known axes | ${cell(estimated.pose.drift.knownAxesTranslationMm)} мм |`,
    `| Placement drift | ${cell(estimated.pose.drift.placementTranslationMm)} мм |`,
    `| Rotation | ${cell(estimated.pose.drift.rotationDeg)} |`,
    '',
    '## Сдвиг переданной позы',
    '',
    '| Внесено, мм | Local, мм | Global, мм | Dice | Surface, мм | Объём vs voxel, % |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.robustness.poseBias.map((row) => `| ${row.injectedTranslationMm} | ${cell(row.pose.local.meanTranslationMm)} | ${cell(row.pose.drift.knownAxesTranslationMm)} | ${cell(row.dice)} | ${surface(row)} | ${cell(row.volumeErrorVsVoxelTruthPercent)} |`),
    '',
    '## RAW и TRIMMED',
    '',
    `RAW registration: сгенерировано ${estimated.generatedFrames}, в сборке ${estimated.usedFrames}, trimmed-набор был бы ${estimated.trimmedFrames} кадров.`,
    `TRIMMED registration: в сборке ${report.robustness.trimmed.usedFrames}, Dice ${cell(report.robustness.trimmed.dice)}, placement drift ${cell(report.robustness.trimmed.pose.drift.placementTranslationMm)} мм.`,
    '',
    '## Производительность',
    '',
    '| Кадры | Размер | Шаг вокселя | Stride | Ядро | Поза | Всего, мс | Оценка памяти, байт |',
    '| ---: | --- | ---: | ---: | ---: | --- | ---: | ---: |',
    ...report.performance.map((row) => `| ${row.generatedFrames} | ${row.width}×${row.height} | ${row.voxelSpacingMm} | ${row.stride} | ${row.kernelRadius} | ${row.poseMode} | ${cell(row.totalMs)} | ${cell(row.estimatedMemoryBytes)} |`),
    '',
  ]
  return lines.join('\n')
}
