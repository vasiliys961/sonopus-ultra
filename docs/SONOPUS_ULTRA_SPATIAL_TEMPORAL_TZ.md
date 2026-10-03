# SONOPUS ULTRA — Spatial-Temporal Intelligence Module v2

Дата фиксации: 2026-10-01.

Sonopus Ultra — не сборщик 3D из нескольких кадров и не 3D-вьюер. Это пространственно-временной движок УЗИ. 3D — один из слоёв анализа.

```text
VIDEO / CINE LOOP → FRAMES → QUALITY → MOTION → SPATIAL POSITION
  → 3D VOLUME → ANATOMY → TEMPORAL FEATURES → PATHOLOGY CANDIDATES
  → CLINICAL REPORT
```

Основная сущность исследования:

```text
ULTRASOUND STUDY = SPACE + TIME + ANATOMY + TISSUE + MOTION + PATHOLOGY
```

## 0. Главная задача

Новый самостоятельный модуль: **Sonopus Ultra Spatial-Temporal Intelligence Engine**.

Он объединяет существующий Sonopus Ultra, Volume Engine, извлечение кадров, анализ cine-loop, реконструкцию 2D → 3D, 3D/MPR из Doctor Opus, анатомию, динамику тканей, кандидатов патологии, опциональную регистрацию с MRI/CT, карту источника, confidence и структурированный результат.

## 1. Критические правила

- Не переписывать существующий Volume Engine.
- Не ломать текущую работу Sonopus Ultra.
- Не менять production-логику без необходимости.
- Не изменять `doctor-opus` и `doctor-opus-global`. Репозиторий Doctor Opus — источник кода и решений.
- Sonopus Ultra остаётся самостоятельным приложением.
- Не переносить UI, навигацию, страницы, авторизацию и брендинг Doctor Opus.
- Не считать модуль клинически валидированным без отдельного исследования.
- Не выдавать `diagnosis confirmed` по одному candidate. До подтверждения evidence pipeline формулировка: `pathological finding candidate`.
- Не использовать MRI и атлас как «фальшивую реальность». Интерполированная и атласная анатомия не равны observed.
- Не загружать длинное видео в RAM целиком.
- Не добавлять библиотеку только потому, что она «умеет 3D».

## 2. Порядок работ

До завершения STEP 1 новый production-код не пишется.

| Шаг | Содержание | Стоп |
| --- | --- | --- |
| 1 | Аудит Sonopus и Doctor Opus, `docs/SONOPUS_ARCHITECTURE_AUDIT.md` | Да, показать результат и ждать |
| 2 | `types/` и provenance | После подтверждения шага 1 |
| 3 | Video extraction: фиксированные 8–12 → adaptive cine sampling | |
| 4 | Cine Engine | |
| 5 | Temporal Engine | |
| 6 | Перенос нужного VTK/3D-кода Doctor Opus адаптером | |
| 7 | US → `vtkImageData` | |
| 8 | US → 3D volume через существующий Volume Engine | |
| 9 | Anatomy Engine, первый орган — печень | |
| 10 | Pathology Candidate Engine | |
| 11 | MRI/CT registration | |
| 12 | Hybrid 3D | |
| 13 | Clinical Report | |

После каждого шага: список файлов, новые зависимости, что перенесено из Doctor Opus, что оставлено в Sonopus, `tsc`, тесты, проверка регрессии.

## 3. Что убрать как основу реконструкции

Текущий путь «видео → 8–12 кадров → AI» не является основным pipeline.

Новый путь:

```text
VIDEO → CINE LOOP → decode → quality → motion → duplicate removal
  → informative frames → temporal sequences → spatial reconstruction
```

Число кадров не фиксируется. Короткая запись может дать десятки кадров, длинная — сотни, но лимиты не жёсткие. Выбор идёт по движению, резкости, похожести, анатомической информации, движению датчика и временному разнообразию.

Если кадры почти одинаковые, в AI уходит меньшая выборка. Если картинка быстро меняется или найден lesion candidate, выборка уплотняется вокруг этого окна (pathology-driven resampling).

AI получает два входа: representative frames и temporal sequences. Весь ролик в LLM не отправляется. Бюджет задаёт `AIFrameBudget`.

## 4. Модель данных

Файлы: `types/spatial-ultrasound.ts`, `types/temporal-ultrasound.ts`, `types/pathology.ts`, `types/provenance.ts`, `types/study.ts`.

Минимальные сущности: `USFrame`, `ProbePose`, `FrameQuality`, `SpatialFrame`, `USVolume`, `LesionCandidate`, `UltrasoundStudy`, `TissueCharacterization`.

`ProbePose.source`: `TRACKER | VIDEO_ESTIMATION | IMAGE_REGISTRATION | MANUAL | UNKNOWN`. Оценка по видео всегда несёт `pose.confidence` и не выдаётся как точный tracking.

`USVolume` хранит dimensions, spacing, origin, coverage, confidence и source map.

Источник вокселя: `US_DIRECT | US_INTERPOLATED | MRI_REGISTERED | CT_REGISTERED | ATLAS_INFERRED | UNKNOWN`.

Уверенность находки раздельная: visual, spatial, temporal, anatomical, model, overall.

Provenance находки: source, confidence, frames, coordinates, model, timestamp, spatialConsistency, temporalConsistency.

## 5. Движки

```text
engine/cine/          decoder, sampler, quality, motion, keyframes, sequence
engine/temporal/      motion, features, deformation, tracking, consistency
engine/spatial/       reconstructor-адаптер, pose, registration, fusion,
                      interpolation, coverage, confidence
engine/anatomy/       graph, landmarks, segmentation, vessels
engine/pathology/     candidates, lesion, anomaly, temporal, artifacts, consistency
engine/registration/  landmarks → rigid → affine → optional deformable
engine/atlas/         только anatomical prior
engine/tissue/        только реально доступные параметры источника
engine/medical-3d/    vtk, volume, mpr, rendering adapters
engine/ai/            vision, temporal, spatial, clinical, frame budget
engine/report/        structured report, findings
```

`engine/spatial/us-volume-reconstructor.ts` — адаптер к существующему Volume Engine, не вторая реализация сплаттинга.

Деформируемая регистрация не запускается автоматически на каждом исследовании.

Атлас не подтверждает сосуд пациента.

Патология ищется в трёх измерениях: spatial, temporal, appearance. Артефакт (тень, реверберация, зеркало, dropout, speckle, motion, out-of-plane, плохой контакт) сам по себе не становится находкой.

Quality gate до патологии: качество кадра, контакт, видимость анатомии, качество движения, покрытие. Иначе `INSUFFICIENT DATA`.

Слои AI: finding candidate → anatomical interpretation → differential suggestion → clinical conclusion. Четыре прохода: vision, temporal, spatial, clinical.

## 6. Doctor Opus как источник 3D

Переносится алгоритмический слой, не UI:

```text
pixel data → vtkImageData → spacing → volume → MPR / volume rendering
```

Нужны: создание `vtkImageData`, spacing, volume mapper, reslice/MPR, camera, interaction, DICOM → объём.

Предпочтительный путь: маленький адаптер. Если код жёстко связан с UI Doctor Opus — копируется только реализация, UI-зависимости снимаются. Отдельный npm-пакет `@doctor-opus/medical-3d-core` не создаётся, пока нет второго реального потребителя.

Режимы экрана Sonopus Intelligence: `2D | CINE | MPR | 3D | HYBRID 3D | PATHOLOGY`.

MPR: axial, sagittal, coronal, oblique. Virtual slice явно помечается `RECONSTRUCTED`, если это не исходный кадр.

US observed, MRI/CT registered и atlas inferred визуально различимы.

## 7. Интерфейс

Новый режим **Sonopus Intelligence**. Панели: CINE, 3D, MPR, ANATOMY, PATHOLOGY, REPORT.

Cine: timeline, FPS, duration, текущий кадр, keyframes, quality, motion, ручной выбор important sequence.

Pathology: finding, location, size, evidence, temporal behavior, confidence, source. Кнопки Show in Cine и Show in 3D.

Traceability: report → finding → 3D location → frames → timestamp исходного видео.

При наличии MRI/CT: Show MRI/CT, Show US, Show Fusion.

Прогрессивный показ: видео загружено → кадры → cine → 2D findings → 3D → pathology → отчёт. UI не блокируется: workers, OffscreenCanvas, ленивая и кусковая обработка, где это оправдано. Цель по памяти: M1 / 8 GB, без удержания всего ролика.

## 8. Первый орган

End-to-end POC — печень: контур, паренхима, воротная вена, печёночные вены, НПВ, желчный пузырь, диафрагма, очаговые изменения.

Дальше thyroid, kidney, heart, vascular, prostate, breast, musculoskeletal добавляются без переписывания Cine, Spatial и 3D.

## 9. Библиотеки и тесты

Сначала зависимости, которые уже есть у Doctor Opus и реально нужны шагу: `vtk.js`, `cornerstone-core`, `cornerstone-tools`, `cornerstone-wado-image-loader`, `dicom-parser`. В Sonopus `dicom-parser` уже есть. Остальное добавляется на шаге переноса 3D, не заранее.

Видео в браузере: `HTMLVideoElement`, Canvas / OffscreenCanvas, `ImageBitmap`, WebCodecs если доступен. FFmpeg только как необязательный server-side fallback.

`@xenova/transformers` — только если локальная feature-задача не закрывается уже существующим кодом.

Тесты: `tests/cine`, `tests/spatial`, `tests/temporal`, `tests/pathology`, `tests/registration`.

Золотой набор позже: `benchmark/cine`, `benchmark/spatial`, `benchmark/pathology` с video и ground truth. Не смешивать с уже существующим `benchmark/freehand3d`.

## 10. Отчёт

Секции: Examination, Anatomy, Findings, Pathology candidates, Limitations, Conclusion. Conclusion только после предыдущих слоёв. Limitations включают недостаточное покрытие, плохое качество и неуверенный spatial tracking.
