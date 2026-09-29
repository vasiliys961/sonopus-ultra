# Stage 3A.1 — benchmark integrity

Stage 3A.1 is a controlled synthetic reconstruction benchmark and is not clinical validation.

Статус: EXPERIMENTAL. Клиническая валидация: нет. TUS-REC: NOT CONNECTED.

- Stage 3A.1 — контролируемый синтетический benchmark. Это не клиническая валидация.
- discrete_surface_distance считается по центрам вокселей сетки фантома. Это не клиническая точность поверхности.
- Аналитический объём и voxel truth — разные представления. Оба показаны отдельно.
- Основной benchmark RAW не выбрасывает крайние кадры. TRIMMED записан отдельно.
- Неизвестные оси позы не заменяются нулём. placementTranslationMm показывает геометрию матрицы, в которую неизвестная ось записана как 0.
- Таймер движка имеет шаг 1 мс. Компонент короче одного тика записан как BELOW_1_MS.
- estimatedMemoryBytes — оценка сетки. runtimeMemoryBytes — разница heap и не является RSS.
- TUS-REC не подключён. Кадры синтетические.

## Вопросы

Q1. Точная поза, сфера, RAW, 20 кадров: Dice 0.76, IoU 0.62, discrete surface reconstruction→GT 1.06 мм, объём против voxel truth 60.86%, против аналитического объёма 64.46%. Расхождение voxel truth и аналитического объёма 2.23%.

Q2. RAW-регистрация тех же кадров: Dice 0.00, IoU 0.00, discrete surface reconstruction→GT NOT AVAILABLE мм, отклонено 19, ошибка INSUFFICIENT_COVERAGE. TRIMMED, кадров 10: Dice 0.21, IoU 0.12, surface 1.43 мм. RAW linear-x: Dice 0.20, IoU 0.11, surface 1.71 мм.

Q3. RAW linear-z: drift известных осей NOT AVAILABLE мм, placement NOT AVAILABLE мм, Z NOT ESTIMATED, поворот NOT ESTIMATED. TRIMMED linear-z: known-axis drift 0.00 мм, placement drift 9.47 мм, поворот NOT ESTIMATED. RAW linear-x: local 2.05 мм, global mean 20.53 мм, drift 39.00 мм, поворот NOT ESTIMATED.

Q4. Сдвиг переданной позы 10 мм: Dice 0.14, surface 2.59 мм. Dropout 30% на проходе X: Dice 0.20. Шум high, регистрация: Dice 0.13.

Q5. 20 кадров 32×32 проход X: точная поза 0.86 мс, регистрация 4.23 мс. 200 кадров: точная поза 26.30 мс, регистрация 72.37 мс. Память в отчёте — estimatedMemoryBytes сетки.

## Три baseline

Voxel truth: занято 925 вокселей, voxel volume 925.00 мм³, аналитический объём 904.78 мм³, расхождение 2.23%.

| | Dice | IoU | Surface GT←recon, мм | Объём vs voxel, % | Объём vs analytic, % | Кадры |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Perfect pose | 0.76 | 0.62 | 1.06 | 60.86 | 64.46 | 20 |
| Registration | 0.00 | 0.00 | NOT AVAILABLE | 100.00 | 100.00 | 20 |

## Поза регистрации

| Local mean | NOT ESTIMATED мм |
| Local Z | NOT ESTIMATED |
| Local rotation | NOT ESTIMATED |
| Global mean | NOT AVAILABLE мм |
| Global P95 | NOT AVAILABLE мм |
| Global max | NOT AVAILABLE мм |
| Drift known axes | NOT AVAILABLE мм |
| Placement drift | NOT AVAILABLE мм |
| Rotation | NOT ESTIMATED |

## Сдвиг переданной позы

| Внесено, мм | Local, мм | Global, мм | Dice | Surface, мм | Объём vs voxel, % |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0.00 | 0.00 | 0.76 | 1.06 | 60.86 |
| 0.5 | 0.00 | 0.00 | 0.76 | 1.06 | 60.86 |
| 1 | 0.00 | 0.00 | 0.76 | 1.06 | 60.86 |
| 2 | 0.00 | 0.00 | 0.73 | 1.26 | 60.86 |
| 5 | 0.00 | 0.00 | 0.53 | 2.21 | 40.11 |
| 10 | 0.00 | 0.00 | 0.14 | 2.59 | 34.70 |

## RAW и TRIMMED

RAW registration: сгенерировано 20, в сборке 20, trimmed-набор был бы 10 кадров.
TRIMMED registration: в сборке 10, Dice 0.21, placement drift 9.47 мм.

## Производительность

| Кадры | Размер | Шаг вокселя | Stride | Ядро | Поза | Всего, мс | Оценка памяти, байт |
| ---: | --- | ---: | ---: | ---: | --- | ---: | ---: |
| 20 | 32×32 | 1 | 1 | 1 | perfect | 0.86 | 3744.00 |
| 20 | 32×32 | 1 | 1 | 1 | registration | 4.23 | 15912.00 |
| 50 | 32×32 | 1 | 1 | 1 | perfect | 2.76 | 3744.00 |
| 50 | 32×32 | 1 | 1 | 1 | registration | 13.51 | 12480.00 |
| 100 | 32×32 | 1 | 1 | 1 | perfect | 28.03 | 3744.00 |
| 100 | 32×32 | 1 | 1 | 1 | registration | 38.14 | 9984.00 |
| 200 | 32×32 | 1 | 1 | 1 | perfect | 26.30 | 3744.00 |
| 200 | 32×32 | 1 | 1 | 1 | registration | 72.37 | 9984.00 |
| 12 | 32×32 | 1 | 1 | 1 | perfect | 1.26 | 37440.00 |
| 12 | 64×64 | 1 | 1 | 1 | perfect | 1.36 | 37440.00 |
| 12 | 128×128 | 1 | 1 | 1 | perfect | 5.10 | 37440.00 |
| 12 | 480×360 | 1 | 4 | 1 | perfect | 0.81 | 21060.00 |
| 12 | 32×32 | 1 | 1 | 1 | perfect | 0.83 | 37440.00 |
| 12 | 32×32 | 1 | 2 | 1 | perfect | 0.65 | 31460.00 |
| 12 | 32×32 | 1 | 4 | 1 | perfect | 0.11 | 21060.00 |
| 12 | 32×32 | 1 | 1 | 0 | perfect | 0.86 | 37440.00 |
| 12 | 32×32 | 1 | 1 | 1 | perfect | 7.75 | 37440.00 |
| 12 | 32×32 | 1 | 1 | 2 | perfect | 8.62 | 37440.00 |
