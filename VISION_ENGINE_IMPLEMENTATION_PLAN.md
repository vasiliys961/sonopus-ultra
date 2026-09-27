# План Vision Engine

Аудит `ultrasound-scanner` перед фазой 1. Документ-источник: `MASTER_TZ_VISION_ENGINE.md`. Фазы 2–6 этим проходом не делаются.

## Что уже есть

| Роль в новом ТЗ | Где лежит сейчас | Решение |
|---|---|---|
| TechnicalFrameGate | `QualityScorer` в `lib/domain/types.ts`, реализация `lib/quality/heuristic-quality-scorer.ts`, допуск кадра `acceptByTechnicalQuality` | Не копировать. Vision Engine вызывает тот же scorer |
| Удержание качества | `QualityStreakTracker` | Свой экземпляр с порогом Vision Engine. Автозахват кабинета остаётся на 0.75 / 1.5 с |
| Кадр | `UltrasoundFrame` | Идентификатор evidence живёт рядом с кадром в буфере, не вторым типом кадра |
| Оценка качества | `QualityScore`: sharpness, brightness, stability, coverage, qualityScore | Отдельного contrast в scorer нет. Motion для селектора — это `1 - stability`, не новая формула |
| Орган и протокол врача | `OrganModule`, реестр из семи модулей, `guidance` | Фаза 3 читает `requiredViews`. Свой протокол не заводится |
| Наблюдение диагноза | `Observation` Brain 1: feature, polarity, evidence | Восприятие — отдельная запись. В Brain 1 она попадёт адаптером в фазе 3 |
| Дифференциал | Brain 2 + арбитр | Не менять в фазе 1. Исход `insufficient_evidence` уже есть |
| Измерение | `MeasurementResult`, шкала DICOM или отметка калиперов | Фаза 4. Без шкалы миллиметры не публикуются и сейчас |
| Облачный вызов | `LlmClient` OpenRouter, разбор JSON `extractJson` | Gemini-провайдер использует их. Второй HTTP-клиент не пишется |
| Приватность | `anonymizeFrame` | Перед любым кадром в облако |
| Геометрия 3D | `lib/spatial-reconstruction/` | Фаза 6 только оборачивает этот модуль |
| Захват | `lib/device-hub`, `native/` | Поток не переписывается. Слой зрения в кабинете выключен, пока врач сам его не включит |
| Подсказка протокола | `lib/guidance/read-pace.ts` | Пауза на чтение шага остаётся |

`ARCHITECTURE.md` не описывает мультиракурс, гипотезу ограниченной достоверности и геометрию. В этом проходе файл архитектуры не переписывается.

## Конфликты

1. ТЗ просит `FrameMetrics.contrast` и отдельные оценщики резкости и движения. Свой scorer их не считает. Выдумывать contrast нельзя.
2. ТЗ просит каталог из десятков файлов сразу. Пустые классы анатомии, протокола и 3D дублировали бы модули органов и `spatial-reconstruction`.
3. Пример mock с меткой thyroid выглядел бы как распознавание. Mock помечает источник `mock_provider` и не называет клинический орган.
4. `enable3DExperimental` в конфиге по умолчанию выключен. Код реконструкции не вызывается.
5. Слова clinically validated в бенчмарке запрещены. Существующие результаты уже несут `clinicallyValidated: false`.

## Файлы

Без изменений: `lib/quality/*`, `lib/pipeline/diagnose.ts`, `lib/diagnostic-arbiter/*`, `lib/ultrasound-modules/*`, `lib/spatial-reconstruction/*`, `components/scan/*`, `app/api/sono/*`, native capture.

Не расширяются в фазе 1.

Создаются в фазе 1:

- `MASTER_TZ_VISION_ENGINE.md`
- `VISION_ENGINE_IMPLEMENTATION_PLAN.md`
- `prompts/vision/observation.prompt.md`
- `lib/vision-engine/config.ts`
- `lib/vision-engine/types.ts`
- `lib/vision-engine/frame-buffer.ts`
- `lib/vision-engine/key-frame-selector.ts`
- `lib/vision-engine/providers/vision-provider.ts`
- `lib/vision-engine/providers/mock-vision-provider.ts`
- `lib/vision-engine/providers/gemini-vision-provider.ts`
- `lib/vision-engine/vision-engine.ts`
- `lib/vision-engine/vision-engine.test.ts`

Deprecated: нет.

Нельзя менять: формулы Quality Gate, эллипсоид, арбитр evidence, обязательные проекции модулей, запрет миллиметров без шкалы.

## Фазы

Фаза 1: буфер, селектор, Gemini, Mock. Кадр ниже порога в модель не уходит.

Фазы 2–6 добавлены поверх этого, без второго Quality Gate и без правки Brain 2:

- анатомия и плоскость читаются из словаря, неизвестная метка не становится органом;
- временное состояние: tracking, stable, lost;
- полнота считается по `requiredViews` выбранного модуля;
- Evidence Pack и `toBrain2Context` отдают контекст, модель при этом не вызывается;
- пустой пакет даёт `insufficient_evidence`;
- миллиметры без шкалы остаются кандидатом;
- спор стороны или размера помечается `possible_tracking_error`;
- Qwen — тот же контракт провайдера и другое имя модели, без отдельной библиотеки;
- бенчмарк пишет `perception_agreement` и `clinicallyValidated: false`;
- 3D вызывается только при включённом флаге и идёт в `lib/spatial-reconstruction/`.

Кабинет показывает слой отдельным выключателем. Пока он выключен, съёмка и разбор идут прежним путём. Маршруты `POST /vision/session`, `POST /vision/frame`, `POST /vision/clip`, `GET /vision/session/:id` и `GET /vision/session/:id/evidence` читают ту же сессию. Без ключа OpenRouter орган не выдумывается.
