# Аудит архитектуры Sonopus Ultra перед Spatial-Temporal Engine

Дата: 2026-10-01. Новый production-код по ТЗ v2 не писался. Volume Engine не менялся. Репозитории Doctor Opus не менялись.

Спецификация: `docs/SONOPUS_ULTRA_SPATIAL_TEMPORAL_TZ.md`.

## Репозитории, которые реально смотрелись

| Роль | Путь | Git |
| --- | --- | --- |
| Sonopus Ultra | `/Users/maxmobiles.ru/Desktop/ultrasound-ultra` | `vasiliys961/sonopus-ultra`, HEAD `a87b4d7` |
| Doctor Opus, текущая локальная ветка | `/Users/maxmobiles.ru/Desktop/doctor-opus` | `vasiliys961/doctor-opus`, ветка `experimental`, `4303fb2`. VTK и `Dicom3DViewer` здесь нет |
| Doctor Opus, снимок с 3D | `/Users/maxmobiles.ru/Desktop/medical-assistant3 Р optima` | тот же `origin` `vasiliys961/doctor-opus`, commit `9221b37`, пакет `medical-assistant3` 4.4.0 |

Папка `Desktop/doctor-opus` — другой снимок того же GitHub-репозитория. Код 3D лежит не в ней, а в checkout `medical-assistant3 Р optima`. Отдельной папки `doctor-opus-global` на диске нет. Предыдущий аудит `SONO_3D_STAGE0_AUDIT.md` описывал viewer Global; фактический исходник vtk для этого шага — checkout Doctor Opus с commit `9221b37`.

## Версии библиотек Doctor Opus

Из `medical-assistant3 Р optima/package.json`:

| Пакет | Версия |
| --- | --- |
| `vtk.js` | `^34.16.3` |
| `cornerstone-core` | `^2.6.1` |
| `cornerstone-math` | `^0.1.10` |
| `cornerstone-tools` | `^6.0.10` |
| `cornerstone-wado-image-loader` | `^4.13.2` |
| `dicom-parser` | `^1.8.21` |

Зритель при этом не импортирует `@kitware/vtk.js`. Он грузит глобальный `window.vtk` скриптом `/libs/vtk/vtk.js` (`Dicom3DViewer.tsx`, `Cinematic3DViewer.tsx`). Пакет в `package.json` и бандл в `public/libs/vtk` — два канала одной библиотеки.

Sonopus сейчас: `next ^14.2.15`, `react ^18.3.1`, `dicom-parser ^1.8.21`, `zod ^3.23.8`. VTK и Cornerstone нет.

## Ответы на десять вопросов аудита

1. **Как загружается видео.** Кабинет `components/ultra/UltraScreen.tsx` держит `<video>`. `components/scan/useScanSession.ts` сажает на него `createUvcAdapter` или `createScreenAdapter` из `lib/device-hub`. Это живой поток `getUserMedia` / захват экрана, не файл ролика как cine-loop.
2. **Как считается число кадров.** Пока идёт проход, кадр кладётся в память, если от предыдущего прошло не меньше `PASS_INTERVAL_MS` (333 мс, около 3 Гц). `trimPass` хранит окно 10 минут. Отдельного decoder длительности и FPS файла нет.
3. **Откуда лимит 8–12.** В Sonopus это не один константный `12`, а цепочка отбора для AI. В Doctor Opus лимит 12 явный.
4. **Где extraction.** Живой поток: `useScanSession.onFrame`. Отбор серии: `lib/ultra/choose-series.ts` и `lib/ultra/select-series.ts`. DICOM-нарезка Doctor Opus: `lib/dicom-client-processor.ts`.
5. **Где кадр становится картинкой.** `rasterToJpeg` в проходе, затем `jpegToRaster` перед моделью. В диагностике `prepareFramesForModel` анонимизирует растр и `encodePng` готовит PNG.
6. **Где запускается AI.** `POST /api/sono/pick-frames` отбирает id кадров. `lib/pipeline/diagnose.ts` гоняет Brain 1 и Brain 2. Слой зрения: `lib/vision-engine`.
7. **Где строится 3D.** `reconstructFreehand` в `lib/volume-engine/core/VolumeEngine.ts`. Кабинет Ultra этот вызов не делает. Экран `/freehand` и бенчмарк `benchmark/freehand3d` вызывают его отдельно.
8. **Где геометрия.** `ReconstructedVolume`: `originMm`, `spacingMm`, `size`, `scalars`, `observed`, `interpolated`, `confidence`, `coverage`. Поза — `Mat4` в `lib/spatial-reconstruction`. Траектория — `lib/volume-engine/trajectory/Trajectory.ts`.
9. **Что уже можно использовать.** Quality gate, анонимизация, Brain 1/2, арбитр, Volume Engine, coverage/confidence, ортогональные срезы своего рендерера, DICOM PixelSpacing.
10. **Что заменить адаптером.** Фиксированный отбор 8/16/24 кадров как основа реконструкции. Глобальный vtk-UI Doctor Opus. Равномерная нарезка DICOM `maxFrames = 12`, если её когда-либо подключат к УЗ-потоку.

## Почему сейчас 8–12, и почему это не реконструкция

Проход уже пишет плотный временной ряд, около 3 кадров в секунду до 10 минут. Узкое место — не запись, а то, что в модель и в «серию» уходит короткая выборка.

| Место | Ограничение | Зачем оно сейчас |
| --- | --- | --- |
| `lib/ultra/pass-loop.ts` `SERIES_LIMIT = 16` | итоговая серия | лента показательных кадров и черновик |
| `choose-series.ts` | `evenSample(..., 24)`, батчи по 8, из батча не больше 4 | уложиться в `POST /api/sono/pick-frames` |
| `app/api/sono/pick-frames/route.ts` | zod: `limit.max(8)`, массив кадров `max(8)`, сторона кадра `max(640)` | контракт одного вызова модели |
| `select-series.ts` | до 16 кадров с зазором 400 мс и порогом качества 0.75 | запасной отбор без модели |
| Doctor Opus `lib/dicom-client-processor.ts` | `sliceDicomFile` / `sliceDicomFolder`, `maxFrames = 12` | равномерный шаг по мультифреймовому DICOM или папке для разбора, не для объёма |

Равномерный шаг Doctor Opus не смотрит на движение, резкость и подозрительный очаг. Серия Sonopus тоже не является входом Volume Engine.

Volume Engine принимает `FreehandFrame[]` без лимита 12. Его пределы другие: сетка по умолчанию `64³`, память 32 МБ, интерполяция выключена, клинические миллиметры только у `reference_test` + `validated_reference`. Это правильная граница, её не ослаблять ради красивого объёма.

## Таблица существующих компонентов

| Existing component | Location | Reuse | Modify | Replace |
| --- | --- | --- | --- | --- |
| Volume Engine | `lib/volume-engine/` | YES | NO на шаге 1. Позже только адаптер входа | NO |
| Сплаттинг и coverage | `reconstruction/WeightedSplatting.ts`, `CoverageMap.ts` | YES | NO | NO |
| Позы reference / sensor / registration / learned | `lib/volume-engine/pose/` | YES | NO | NO |
| Свой MPR-срез объёма | `lib/volume-engine/rendering/SliceRenderer.ts`, `VolumeRenderer.ts` | YES как проверка чисел | NO | NO как клинический vtk-viewer |
| Запись прохода | `components/scan/useScanSession.ts`, `lib/ultra/pass-loop.ts` | YES как источник cine | YES: не резать ряд до серии до реконструкции | NO |
| Отбор серии для заключения | `lib/ultra/choose-series.ts`, `select-series.ts`, `pick-frames` | YES для черновика заключения | YES: перестать быть входом 3D и единственным входом AI | NO целиком |
| Quality gate | `lib/quality/` | YES | позже расширить поля `FrameQuality` адаптером | NO |
| Анонимизация | `lib/anonymization/` | YES | NO | NO |
| Brain 1 / Brain 2 / арбитр | `lib/pipeline/diagnose.ts`, `lib/llm-pipeline/`, `lib/diagnostic-arbiter/` | YES | позже бюджет кадров и слои candidate → conclusion | NO |
| Vision keyframe score | `lib/vision-engine/key-frame-selector.ts` | YES как вес кадра | позже типы keyframe из ТЗ | NO |
| Анатомия зрения | `lib/vision-engine/anatomy/anatomy-detector.ts` | YES, печень уже в списке меток | NO как граф органов | NO |
| Органные модули | `lib/ultrasound-modules/` | YES | NO. Модуля печени нет: печень идёт как свободный проход | NO |
| Старый spatial compounder | `lib/spatial-reconstruction/volume-compounder.ts` | NO для нового объёма | NO | оставить, не вызывать из нового пути |
| Заглушка TUS-REC | `lib/spatial-reconstruction/pose-network/`, `pose/tus-rec/` | YES как отказ без весов | NO | NO |
| Кабинет Ultra | `components/ultra/`, `app/page.tsx` | YES | позже режим Intelligence отдельным входом | NO |
| DICOM PixelSpacing Sono | `lib/dicom/` | YES | позже US Region, не ломая текущую шкалу | NO |
| Doctor Opus vtk UI | `components/Dicom3DViewer.tsx` (1019 строк), `Cinematic3DViewer.tsx` (645) | алгоритм vtk, не компонент | вынести адаптер | UI не переносить |
| Doctor Opus объём и downsample | `lib/dicom-3d-processor.ts` | YES, `estimateVolumeStats`, `prepareVolumeData` | spacing сейчас заглушка `[1,1,1]` в оценке | NO |
| Doctor Opus нарезка 12 кадров | `lib/dicom-client-processor.ts` | декод DICOM через Cornerstone | не использовать `maxFrames = 12` для cine | как основа реконструкции — да, убрать |
| Doctor Opus серверный DICOM | `lib/dicom-processor.ts` | анонимизация буфера и разбор | не тащить серверный UI-поток | NO целиком |
| Локальный `Desktop/doctor-opus` experimental | другой commit | NO для 3D | NO | не источник vtk |

## Код Doctor Opus, который можно переиспользовать

Вход зрителя: `{ files: File[]; onClose; presentation?: 'modal' | 'fullscreen' }`. Готовую сетку, позы и маски покрытия он не принимает.

Внутри `Dicom3DViewer.tsx`, без отдельного экспорта:

- сортировка срезов по позиции, иначе по номеру инстанса;
- XY из PixelSpacing, Z из толщины среза или разницы соседних позиций, если она между 0.1 и 20 мм;
- для не-DICOM картинок запасной шаг `[1, 1, 3]` мм;
- стек в `vtkImageData` как параллельные срезы;
- `vtkVolume` + `vtkVolumeMapper`, sample distance 0.35–0.9;
- три плоскости через `vtkImageResliceMapper` + `vtkPlane` + `vtkImageSlice`: axial, coronal, sagittal;
- камера, trackball, пресеты цвета bone / brain / vessels. Это transfer function, не характеристика ткани УЗИ.

`lib/dicom-3d-processor.ts`: оценка памяти и `vtkImageResample`, если объём большой. В `estimateVolumeStats` spacing всегда `[1,1,1]` и помечен как базовый.

`Cinematic3DViewer` принимает те же `{ files, onClose }` и тот же скрипт vtk.

Этот код складывает срезы стопкой с постоянным Z. Свободный проход датчика так класть нельзя: соседние кадры УЗИ не являются параллельными срезами. Переносить нужно фабрику `vtkImageData`, mapper, reslice и камеру. Сборку объёма из файлов DICOM оставлять для MRI/CT.

## Код Sonopus, который остаётся

- Кабинет, подключение аппарата, диктовка, язык интерфейса.
- Quality gate и запрет миллиметров без шкалы.
- Модули пузыря, НПВ, eFAST, лёгких, щитовидной, фракции выброса, свободного прохода.
- `diagnose.ts`, арбитр, анонимизация до модели.
- Весь `lib/volume-engine`, включая отказ строить позу без датчика или весов.
- Бенчмарк `benchmark/freehand3d`.
- Существующий `TZ.md` продукта «кино, серия, черновик». Новый движок его не отменяет.

## Код Sonopus, который нужно изменить позже

Не на этом шаге.

- Отделить cine-поток прохода от серии из 16 кадров. Серия остаётся для черновика заключения.
- Добавить режим файла видео, не только живой `<video>` поток.
- Адаптер `FreehandFrame` ← `USFrame` + поза, без второй реконструкции.
- Второй вход vtk: уже собранные scalars, origin, spacing, direction. Не подменять `files: File[]` у КТ/МРТ.
- Экран Intelligence рядом с текущим кабинетом, не вместо него.
- Модуль печени поверх тех же cine/spatial слоёв. Сейчас печени в `organModuleRegistry` нет; метка `liver` есть только в списке анатомии зрения.

## Новые зависимости

На шаге 1 не добавлялись.

Когда дойдёт шаг vtk:

| Зависимость | Решение |
| --- | --- |
| `dicom-parser` | уже в Sonopus `^1.8.21`, вторую копию не ставить |
| `vtk.js` `34.16.3` | добавить на шаге адаптера. Предпочесть npm-импорт, не копировать `public/libs/vtk/vtk.js` и не вешать `window.vtk` |
| `cornerstone-core`, `cornerstone-wado-image-loader` | только для DICOM MRI/CT и мультифреймового US DICOM. Для обычного видео не нужны |
| `cornerstone-tools`, `cornerstone-math` | не добавлять, пока нет инструмента разметки на cornerstone-вьюере |
| FFmpeg | не добавлять в браузер |
| `@xenova/transformers` | не добавлять, пока хватает резкости, гистограммы и уже существующего quality score |

## Архитектура нового модуля

Новые файлы живут рядом с текущими, не внутри `lib/volume-engine`.

```text
types/          контракт кадра, позы, исследования, provenance
engine/cine/    декод и адаптивная выборка
engine/temporal/
engine/spatial/ адаптер к reconstructFreehand
engine/medical-3d/  vtkImageData и MPR поверх готового объёма
engine/anatomy/
engine/pathology/
engine/registration/
engine/atlas/
engine/tissue/
engine/ai/
engine/report/
```

Поток:

```text
живой поток или файл
        │
        ▼
   cine (весь ряд, не 16 кадров)
        │
        ├── temporal sequences ──► AI budget
        │
        └── кадры + поза ──► существующий Volume Engine
                                    │
                                    ▼
                              ReconstructedVolume
                                    │
                                    ▼
                              vtk-адаптер (позже)
```

Черновик заключения текущего кабинета продолжает брать короткую серию. Реконструкция эту серию не использует.

## Риски

1. Два checkout Doctor Opus расходятся. Источник vtk — commit `9221b37` в `medical-assistant3 Р optima`. Ветка `experimental` в `Desktop/doctor-opus` этот код не содержит. Копировать нужно из первого, не из второго.
2. `Dicom3DViewer` — один React-компонент на тысячу строк с глобальным `window.vtk`, пресетами КТ и входом `File[]`. Прямой импорт в Sonopus притянет UI и сломает свободный проход, если скормить ему кадры как срезы.
3. Запасной spacing `[1,1,3]` для картинок не является шкалой УЗИ. Без PixelSpacing или трекера объём остаётся геометрической моделью с `pose.confidence`, не измерением в миллиметрах. Volume Engine это уже запрещает вне эталонного теста.
4. Проход хранит JPEG каждого третьего кадра в памяти вкладки до 10 минут. Длинный cine без кусковой обработки на M1 / 8 GB раздует RAM ещё до 3D.
5. Уплотнение выборки вокруг очага нельзя делать, пока нет candidate. Первый cine-шаг умеет только quality, motion и похожесть. Pathology-driven resampling — после движка кандидатов.
6. Печень не модуль измерения. POC не должен начать ставить миллиметры печени без шкалы.
7. Регистрация MRI/CT и deformable — отдельные поздние шаги. Автозапуск на каждом исследовании запрещён ТЗ.
8. Модуль не клинически валидирован. Отчёты остаются черновиком и кандидатами.

## Порядок реализации после подтверждения

1. Типы и provenance, без смены кабинета и Volume Engine.
2. Cine decoder и adaptive sampler на ряде прохода и на файле видео. Серия из 16 кадров остаётся только для текущего черновика.
3. Тесты cine: короткий ряд, длинный ряд, почти одинаковые кадры, низкое качество.
4. Temporal features по уже отобранным последовательностям.
5. Адаптер `USFrame` → `FreehandFrame` → `reconstructFreehand`. Новые маски источника не подменяют `observed` / `interpolated`.
6. Узкий vtk-адаптер: готовый `ReconstructedVolume` → `vtkImageData` → volume и MPR. UI Doctor Opus не копируется.
7. Экран Intelligence: cine, срезы, покрытие. Патология и MRI — следующими шагами.
8. Анатомия печени как слой меток, не как диагноз.
9. Кандидаты патологии с раздельным confidence.
10. Регистрация и hybrid только когда есть второй объём DICOM.
11. Структурированный отчёт последним.

STEP 2 не начат.
