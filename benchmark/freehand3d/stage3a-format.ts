import type { CaseMetrics, Stage3AReport } from '@/benchmark/freehand3d/stage3a'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'

function cell(value: MetricValue | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  return String(value ?? 'NOT AVAILABLE')
}

function row(metrics: CaseMetrics): string {
  const z = metrics.poseMode === 'perfect' ? 'ground truth' : cell(metrics.translationErrorZMm)
  const rotation = metrics.poseMode === 'perfect' ? 'ground truth' : cell(metrics.rotation)
  return `| ${metrics.phantom} | ${metrics.sweep} | ${metrics.poseMode} | ${metrics.noise} | ${metrics.dropoutPercent}% | ${metrics.frames} | ${cell(metrics.surfaceMeanDistanceMm)} | ${cell(metrics.dimensionErrorPercent)} | ${cell(metrics.volumeErrorPercent)} | ${cell(metrics.coverage)} | ${z} | ${rotation} |`
}

export function stage3aMarkdown(report: Stage3AReport): string {
  const perfect = report.perfectPose
  const registration = report.registration
  const lines = [
    '# Stage 3A — freehand 3D proof of concept',
    '',
    'Статус: EXPERIMENTAL. Клиническая валидация: нет. TUS-REC: NOT CONNECTED.',
    '',
    report.image.note,
    `Кадр ${report.image.width}×${report.image.height}, шаг пикселя ${report.image.pixelSpacingMm} мм, stride ${report.image.stride}, ядро радиуса ${report.image.kernelRadius}.`,
    'Покрытие сетки — это доля наблюдённых вокселей в выделенной сетке. Это не точность геометрии.',
    'Неизвестная ось позы записана как NOT ESTIMATED. Ноль туда не подставлялся.',
    '',
    '## Вопросы',
    '',
    `Q1. ${report.questions.q1}`,
    '',
    `Q2. ${report.questions.q2}`,
    '',
    `Q3. ${report.questions.q3}`,
    '',
    '## Точная поза и регистрация',
    '',
    '| | Поверхность, мм | Размер, % | Объём, % | Покрытие | Центроид, мм |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| Точная поза | ${cell(perfect.surfaceMeanDistanceMm)} | ${cell(perfect.dimensionErrorPercent)} | ${cell(perfect.volumeErrorPercent)} | ${cell(perfect.coverage)} | ${cell(perfect.centroidErrorMm)} |`,
    `| Регистрация | ${cell(registration.surfaceMeanDistanceMm)} | ${cell(registration.dimensionErrorPercent)} | ${cell(registration.volumeErrorPercent)} | ${cell(registration.coverage)} | ${cell(registration.centroidErrorMm)} |`,
    '',
    `Регистрация, перенос MAE: X ${cell(registration.translationErrorXMm)} мм, Y ${cell(registration.translationErrorYMm)} мм, Z ${cell(registration.translationErrorZMm)}, сумма известных осей ${cell(registration.totalTranslationErrorMm)} мм.`,
    `Поворот регистрации: ${cell(registration.rotation)}. Отклонено кадров: ${registration.rejectedFrames}.`,
    `Поверхность p95 ${cell(registration.surfaceP95DistanceMm)} мм, Хаусдорф ${cell(registration.hausdorffDistanceMm)} мм.`,
    `Точная поза: p95 ${cell(perfect.surfaceP95DistanceMm)} мм, Хаусдорф ${cell(perfect.hausdorffDistanceMm)} мм, диаметр ${cell(perfect.diameterErrorMm)} мм (${cell(perfect.diameterErrorPercent)}%).`,
    '',
    '## Чувствительность к сдвигу по Z',
    '',
    '| Сдвиг, мм | Поверхность, мм | Размер, % | Объём, % | Центроид, мм |',
    '| ---: | ---: | ---: | ---: | ---: |',
    ...report.sensitivity.map((item) => `| ${item.injectedTranslationMm} | ${cell(item.surfaceMeanDistanceMm)} | ${cell(item.dimensionErrorPercent)} | ${cell(item.volumeErrorPercent)} | ${cell(item.centroidErrorMm)} |`),
    '',
    '## Чувствительность к наклону',
    '',
    'Наклон добавлен к эталонной позе. Базовая регистрация поворот не оценивает.',
    '',
    '| Градусы | Поверхность, мм | Размер, % | Объём, % |',
    '| ---: | ---: | ---: | ---: |',
    ...report.rotationSensitivity.map((item) => `| ${item.injectedRotationDeg.toFixed(0)} | ${cell(item.surfaceMeanDistanceMm)} | ${cell(item.dimensionErrorPercent)} | ${cell(item.volumeErrorPercent)} |`),
    '',
    `Регистрация с поиском поворота на проходе сдвиг+поворот: поворот ${cell(report.rotationEnabledRegistration.rotation)}. Это не базовый режим. Базовый режим остаётся NOT ESTIMATED.`,
    '',
    '## Матрица',
    '',
    '| Фантом | Проход | Поза | Шум | Пропуски | Кадры | Поверхность | Размер % | Объём % | Покрытие | Z | Поворот |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.matrix.map(row),
    '',
    '## Проходы сферы',
    '',
    '| Фантом | Проход | Поза | Шум | Пропуски | Кадры | Поверхность | Размер % | Объём % | Покрытие | Z | Поворот |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.sweeps.map(row),
    '',
    '## Фантомы, точная поза, проход по Z',
    '',
    '| Фантом | Проход | Поза | Шум | Пропуски | Кадры | Поверхность | Размер % | Объём % | Покрытие | Z | Поворот |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.phantoms.map(row),
    '',
    'Расстояние между двумя цилиндрами, ошибка мм: ' + cell(report.phantoms.find((item) => item.phantom === 'parallel-cylinders')?.separationErrorMm),
    '',
    '## Время и память',
    '',
    'Память — оценка сетки до смысла клинического ОЗУ. Таймер движка имеет шаг 1 мс.',
    '',
    '| Кадры сгенерировано (в сборке) | Поза | Поза, мс | Сэмплинг, мс | Сплат, мс | Сборка, мс | Всего, мс | Память, байт |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.performance.map((item) => `| ${item.generatedFrames} (${item.frames}) | ${item.poseMode} | ${item.poseMs} | ${item.samplingMs} | ${item.splattingMs} | ${item.reconstructionMs} | ${item.wallTimeMs.toFixed(1)} | ${cell(item.memoryBytes)} |`),
    '',
  ]
  return lines.join('\n')
}
