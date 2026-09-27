# Doctor Opus Sono Vision Engine

## MASTER_TZ_VISION_ENGINE v1.0

Implementation-ready specification. Весь документ не реализуется одним проходом. Сначала `VISION_ENGINE_IMPLEMENTATION_PLAN.md`, затем фазы из раздела 50. Существующий Sono не переписывается.

Gemini 3.8 Flash умеет анализировать видео с настраиваемым FPS, но не используется как покадровый трекер. Qwen3-VL поддерживает видео, время и пространство и остаётся необязательным провайдером.

### Главная задача

Модуль **Doctor Opus Sono Vision Engine** превращает поток ультразвукового видео в структурированное исследование:

1. realtime-подсказка во время сканирования;
2. автоматический выбор пригодных кадров;
3. анатомическая область;
4. плоскость сканирования;
5. отслеживание структур во времени;
6. измерения-кандидаты;
7. полнота протокола;
8. Evidence Pack;
9. передача Evidence Pack в существующий Brain 2;
10. задел под sensorless freehand 3D.

Vision Engine отвечает на вопрос «что и где видно и насколько это пригодно». Brain 2 отвечает на вопрос «что это может означать клинически».

## 1. Критическое правило

Перед кодом: изучить репозиторий, `ARCHITECTURE.md`, действующее ТЗ Sono, интерфейсы, OrganModule, Quality Gate, LLM pipeline, native capture и тесты. Затем план с файлами: без изменений, расширяются, создаются, deprecated, нельзя менять. Большой рефакторинг ради Vision Engine запрещён.

## 2. Философия

```text
ULTRASOUND STREAM → ACQUISITION → QUALITY ENGINE → FRAME SELECTOR
→ VISION ENGINE → ANATOMY / PLANE / STRUCTURE → TEMPORAL TRACKING
→ MEASUREMENT CANDIDATES → PROTOCOL STATE → EVIDENCE BUILDER
→ BRAIN 2 → MEDICAL INTERPRETATION
```

Vision Engine не является новым диагностическим Brain.

## 3. Три режима

- **A. Live assist.** Анатомия, плоскость, quality, stability, короткая подсказка. Подсказка не ставит диагноз.
- **B. Scan to report.** Видео → кадры → клипы → анатомия → плоскости → измерения → полнота → Evidence Pack → Brain 2.
- **C. Freehand 3D.** Экспериментальная ветка. Не блокирует A и B. Без клинических утверждений.

## 4. Каталог

Корень: `lib/vision-engine/`. Имена из ТЗ (VisionEngine, types, acquisition, quality, selection, providers, anatomy, plane, tracking, measurement, protocol, evidence, router, telemetry, experimental) вводятся по фазам, а не пустыми файлами заранее.

## 5. VisionProvider

Интерфейс провайдера: `analyzeFrames`, `analyzeClip`, `identifyAnatomy`, `identifyPlane`, `extractObservations`. Логика Gemini и Qwen не живёт внутри `VisionEngine`.

## 6. Провайдеры

- **GeminiVisionProvider.** Основной облачный провайдер. Модель задаётся конфигом, ориентир `gemini-3.8-flash`. Задачи: анатомия, плоскость, структурированные наблюдения, выбранный клип, трудные кадры. Не каждый кадр потока. Параметр sampling FPS.
- **QwenVisionProvider.** Абстракция под Qwen3-VL для сравнения, бенчмарка и будущего локального инференса. Не обязательная зависимость MVP.
- **MockVisionProvider.** Весь pipeline без API, для CI.

## 7. Fast loop

LLM/VLM не вызывается на каждом кадре. Поток 10–30 FPS обрабатывается локально. Метрики кадра берутся из существующего `QualityScorer`. Отдельные SharpnessEstimator и MotionEstimator не создаются, пока их роль закрыта текущим scorer.

## 8. Vision loop

Разбор зрения реже: около 2–5 FPS или только selected frames/clips.

```text
FAST LOOP → candidate → KeyFrameSelector → VisionProvider → structured observation
```

## 9. KeyFrameSelector

Оценка по quality, stability, anatomy confidence, plane confidence, novelty, temporal distance, protocol relevance. Веса настраиваются. Пока анатомия и протокол не построены, их вклад равен нулю и не подменяется выдуманным числом.

## 10. ClipSelector

Клип вокруг события, например −2…+3 с. Причина: `best_quality | anatomy | measurement | motion | protocol | uncertain`. Фаза после селектора кадров.

## 11. Anatomy engine

Орган, регион, сторона, структура, confidence. Первый словарь: thyroid, carotid, jugular, lung, pleura, heart, IVC, bladder, kidney, liver, gallbladder, aorta. Новый орган не требует правки ядра. Не дублирует `OrganModule`: модуль органа остаётся измерением и протоколом врача, детектор только предлагает метку.

## 12. Plane engine

Состояния: unknown, longitudinal, transverse, oblique, apical, parasternal_long, parasternal_short, subcostal, suprasternal. У каждой метки confidence и evidenceFrameIds.

## 13. Temporal tracking

Кадр не является независимой картинкой. Состояние: unstable, tracking, stable, lost. История confidence и quality, stableForMs.

## 14. Structure tracking

Границы, сосуды, стенки, очаги, камеры, плевральная линия, контур пузыря, НПВ. На MVP достаточно box, point, region. Полная сегментация подготовлена интерфейсом и не обязательна.

## 15. Measurement engine

`MeasurementCandidate` и подтверждённое измерение разделены. Без PixelSpacing или подтверждённой шкалы физическое число не публикуется как достоверное. Существующий `MeasurementResult` не заменяется.

## 16. Protocol engine

Что уже снято, что подтверждено, каких обязательных проекций нет, какие кадры пригодны, completeness. Опирается на `OrganModule.requiredViews`, не ведёт второй протокол.

## 17. Guidance

Текст про удержание, найденную проекцию, пригодность, недостающий поворот, движение, неподтверждённую плоскость. Guidance не утверждает диагноз. Технические подсказки Quality Gate по-прежнему не называют орган и датчик.

## 18. Evidence Pack

studyId, anatomy, planes, measurements, observations, selectedFrames, selectedClips, protocol, qualitySummary, uncertainties, contradictions, completeness, generatedAt.

## 19. Evidence-first

Brain 2 получает Evidence Pack, а не фразу «модель посмотрела видео». Существующий Brain 2 не переписывается: адаптер готовит вход.

## 20. Uncertainty

У наблюдения confidence и uncertaintyReason. Низкая уверенность не становится фактом.

## 21. ContradictionDetector

Резкая смена стороны или два разных размера одной структуры без объяснения дают `possible_tracking_error`, а не выбор «победителя».

## 22. VisionModelRouter

Выбор провайдера по задаче, сложности, задержке, стоимости, уверенности и доступности. Настраивается. Имя модели не зашито в ядре.

## 23. Конфиг провайдера

`provider`, `model`, `maxLatencyMs`, `maxCost`, `enabled`.

## 24. Промпты

Текст лежит в `prompts/vision/`, не внутри оркестратора. JSON, confidence, uncertainty, ссылка на кадр. Диагноз только если его явно просят. Измерения и допущения не выдумываются.

## 25. Нормализация

Ответ провайдера приводится к `schemaVersion: vision-1.0`. Свободный текст модели не управляет протоколом.

## 26. Typed JSON

Состояние протокола не строится регулярными выражениями по тексту модели.

## 27. 3D engine

Экспериментальный контур: кадры, признаки, относительное преобразование, траектория, пространственная согласованность, реконструкция. Без клинических заявлений и без автоматических диагностических измерений.

## 28. Sensorless 3D

Хранится relative transformation, не абсолютная поза датчика. Уже есть `lib/spatial-reconstruction/`. Новый движок не копирует интегратор и компаундер.

## 29. Benchmark

`benchmark/vision/` и runner для Gemini, Qwen, Mock и будущих локальных моделей на одном наборе.

## 30. Метрики

Anatomy и plane: accuracy, macro F1. Кадры: precision, recall. Измерения: MAE, MAPE только при ground truth. Протокол: completion и missing-view. Время: stability, identity switches, track loss. Система: latency, FPS, CPU, memory, API calls, estimated cost.

## 31. Честный бенчмарк

Без clinical ground truth запрещены слова diagnostic accuracy, clinical accuracy, validated, clinically validated. Допустимы prototype performance, research benchmark, model agreement, perception accuracy.

## 32. Тесты

Отдельные тесты селектора, клипа, трекеров, протокола, evidence, валидатора измерений, роутера. Обязательные случаи:

1. quality ниже порога → модель не вызывается;
2. мало evidence → `insufficient_evidence`, не «норма»;
3. нет шкалы → измерение остаётся candidate;
4. конфликт наблюдений → contradiction;
5. провайдер недоступен → скан не падает;
6. таймаут Gemini → запасной путь или тихий отказ, без выдуманного разбора.

## 33. Сбои

Отключение камеры и граббера, пустой и битый кадр, низкий FPS, движение, пересвет, недосвет, таймаут, недоступный API, невалидный JSON, мало evidence, противоречия, нет шкалы, нет проекции. Ни один сбой не приводит к ложному диагнозу.

## 34. Производительность

Fast loop 10–30 FPS. Quality scoring ориентир < 50 мс/кадр на desktop. Vision analysis не на каждый кадр, эквивалент 2–5 FPS по выбранным. Brain 2 только после достаточного Evidence Pack.

## 35. Кэш

Одинаковые кадры не отправляются в облако повторно. Ключ: provider, model, promptVersion, frameFingerprint, task.

## 36. Стоимость

Каждый вызов пишет provider, model, task, latencyMs, inputFrames, outputTokens, estimatedCost. Сводка: processed, selected, VLM calls, cache hits, latency, cost.

## 37. Приватность

Перед облаком используется существующая `anonymizeFrame`. В промпт не попадают имя, дата рождения, MRN, адрес, телефон. Из DICOM берётся только нужная метадата.

## 38. Интеграция

`DoctorOpusEvidenceAdapter`: Evidence Pack → контекст для существующего Brain 2. Brain 2 не меняется без необходимости.

## 39. UI

Минимальная панель разработчика: quality, anatomy, plane, confidence, tracking, полнота протокола, guidance, счётчики evidence. Без перерисовки кабинета в первой фазе.

## 40. Debug

`VISION_DEBUG=true`: FPS, quality, выбранный кадр, anatomy, plane, confidence, tracking, provider, latency.

## 41. Журнал

Без персональных данных. События: FRAME_RECEIVED, QUALITY_REJECTED, FRAME_SELECTED, VISION_REQUEST, VISION_RESPONSE, ANATOMY_CHANGED, PLANE_CHANGED, TRACK_LOST, MEASUREMENT_CANDIDATE, PROTOCOL_STEP_COMPLETED, EVIDENCE_PACK_CREATED, BRAIN2_REQUEST.

## 42–43. Конфиг

`fastLoopFps` 15, `visionLoopFps` 2, `minQualityScore` 0.75, `minStableMs` 1000, tracking/protocol/measurements включены, `enable3DExperimental` false. Всё настраивается. Облако выключено, пока провайдер не передан.

## 44. Совместимость

UVC/HDMI, захват экрана, синтетический демо-поток и DICOM hot-folder работают как раньше. Выключенный Vision Engine не меняет старый Sono.

## 45. Mock

Синтетический кадр проходит до наблюдения без сети. Это не клиническая метка.

## 46. Demo data

`demo/vision/` с кадрами, metadata и expected.json. Без реальных персональных данных. Не в первой фазе, если нет готового набора.

## 47. API

Новый backend только ради Vision Engine не создаётся. Ядро — TypeScript. Маршруты `/vision/*` добавляются, когда ядро уже вызывается из существующего Next API.

## 48. События

Отдельная шина не вводится. Возврат результата из `VisionEngine` достаточен, пока нет подписчиков.

## 49. Безопасность

Нет окончательного диагноза, нет скрытой неуверенности, гипотеза не становится фактом, нет мм без шкалы, нет «нормы» при нехватке evidence. Исход: `insufficient_evidence`.

## 50. Фазы

1. FrameBuffer, интеграция Quality Engine, KeyFrameSelector, VisionProvider, GeminiVisionProvider, MockVisionProvider.
2. AnatomyDetector, PlaneDetector, TemporalTracker.
3. ProtocolStateMachine, EvidenceBuilder, DoctorOpusEvidenceAdapter.
4. MeasurementCandidateEngine.
5. QwenProvider, benchmark.
6. Sensorless3DEngine поверх существующей геометрии.

## 51. Порядок

Аудит → план → типы → интерфейс провайдера → mock → буфер → селектор → Gemini → анатомия → плоскость → трекер → Evidence Pack → протокол → адаптер Brain 2 → тесты → бенчмарк → Qwen → экспериментальный 3D. После фазы: `npm test` и проверка типов существующей командой проекта.

## 52. Не раздувать

Не добавлять Kubernetes, микросервисы, Redis, Kafka, PostgreSQL, новый backend и новый frontend-фреймворк.

## 53–54. Не дублировать

Если есть QualityScorer, OrganModule, кадр, оценка качества или измерение, расширять или адаптировать, а не заводить вторую копию.

## 55. Целевая схема

Поток остаётся Acquisition → существующий Quality Gate → быстрый цикл → выбор кадра → Vision Engine → Evidence Pack → адаптер → существующий Brain 2. 3D идёт параллельной экспериментальной веткой.

## 56. Definition of Done

Отдельный модуль, старый Sono жив, есть абстракция провайдера, Gemini и Mock, кадры выбираются, анатомия и плоскость распознаются, есть временное состояние, Evidence Pack со ссылками, confidence и uncertainty уходит в адаптер Brain 2, insufficient evidence и измерение без шкалы обрабатываются, сбой модели не роняет скан, тесты и сборка проходят, fast loop не ждёт облако, VLM только на выбранных кадрах, telemetry пишет задержку и число вызовов.

Пункты про анатомию, плоскость, Evidence Pack и адаптер Brain 2 закрываются фазами 2–3, не фазой 1.

## 57. Принцип

Не «LLM смотрит на ультразвук и ставит диагноз», а «восприятие собирает привязанное к кадрам исследование, которое затем разбирает отдельный reasoning engine».

## 58. Старт для агента

Не начинать с реализации всего файла. Аудит, сопоставление с QualityScorer, TechnicalFrameGate, OrganModule, Brain 1, Brain 2, native capture и LLM pipeline, план, список файлов, конфликты, затем фаза 1. Не удалять работающие функции. Не подменять интеграцию заглушкой, кроме предусмотренного MockVisionProvider. Не называть систему clinically validated. Не добавлять диагностические утверждения вне Evidence Pack.
