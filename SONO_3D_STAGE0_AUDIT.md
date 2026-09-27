# Этап 0. Аудит Sono 3D

Решение после аудита: отдельный вход внутри Sono, страница `/freehand`. Код зрителя КТ из doctor-opus-global не копируется. Возможности геометрии пишутся в `lib/sono-3d/`.

Дата: 2026-09-27. Код реконструкции по новому ТЗ не писался. Checkpoint не скачивался.

Репозитории:

- Sono: `/Users/maxmobiles.ru/Desktop/ultrasound-scanner`, GitHub `vasiliys961/ultrasound-scanner`, Next.js 14, пакет `doctor-opus-sono`.
- Viewer: GitHub `vasiliys961/doctor-opus-global`, ветка `main`, снимок дерева на 2026-09-25. Локальная папка `Desktop/doctor-opus` — другой продукт на Python и pydicom. Её viewer нет.

## Что есть вместо Sensorless3DEngine

Имени `Sensorless3DEngine` в коде нет. Оно встречается только как будущая строка в `MASTER_TZ_VISION_ENGINE.md`.

Фактическая цепочка:

| Файл | Что делает на самом деле |
| --- | --- |
| `lib/spatial-reconstruction/pose-network/pose-model.ts` | Интерфейс `PoseModel.predictPair`. `requirePoseModel(null)` бросает «Сеть позы не подключена. Веса TUS-REC не приложены…». |
| `lib/spatial-reconstruction/pose-network/onnx-pose.ts` | Заглушка адаптера. `OnnxPoseSession.runPair` должен вернуть 6 чисел `[tx,ty,tz,rx,ry,rz]`. `onnxruntime` в `package.json` нет, файл весов нет. Раскладка — договорённость нашей обёртки, не формат checkpoint TUS-REC. |
| `lib/spatial-reconstruction/reconstruct.ts` | `reconstructScan(frames, model)` требует модель и минимум 2 кадра. |
| `lib/spatial-reconstruction/trajectory-integrator.ts` | `global_i = global_{i-1} * T`. |
| `lib/spatial-reconstruction/rigid.ts` | `Mat4` по строкам, `p' = M·p`, поворот `R = Rz·Ry·Rx`, перенос в мм. Инверсии матрицы нет. |
| `lib/spatial-reconstruction/volume-compounder.ts` | `compoundVolume`. Изотропный `mmPerPixel`, пиксель в плоскости `z=0`, сетка не больше 32³. Чёрные пиксели тоже занимают воксель. Масок observed / interpolated / prior нет. |
| `lib/spatial-reconstruction/metrics.ts` | Имена GPE, GLE, LPE, LLE. `lepMm` равен `lpeMm`. Прогона по датасету нет. |
| `lib/vision-engine/experimental/sensorless-3d.ts` | `runExperimental3d`. Флаг false → `disabled` и пустая траектория. Исключение → `degraded`. Объём не возвращает. |
| `lib/vision-engine/config.ts` | `enable3DExperimental: false`. Движок зрения этот флаг не включает. |
| `components/scan/Sensorless3dPanel.tsx` | Всегда вызывает `runExperimental3d(true, снимки, null)`. Поэтому на экране статус «ограничен», траектория 0, сетка не строится. |

Домен модели зафиксирован как `'forearm-tus-rec'`. Текст ограничения: `TUS_REC_LIMITATION` в `lib/spatial-reconstruction/types.ts`.

## Viewer doctor-opus-global

Страницы КТ, МРТ и `/advanced-3d` монтируют `components/Dicom3DViewer.tsx`.

Контракт входа: `{ files: File[]; onClose; presentation?: 'modal' | 'fullscreen' }`.

Внутри файла, не в отдельном экспорте:

- сортировка срезов по `ImagePositionPatient` (0020,0032), иначе по Instance Number;
- шаг XY из `PixelSpacing` (0028,0030), Z из Slice Thickness (0018,0050) или из разницы Z двух соседних позиций, если она между 0.1 и 20 мм;
- для не-DICOM картинок запасной шаг `[1, 1, 3]` мм;
- стек кладётся в `vtkImageData` как параллельные срезы;
- три MPR (аксиальный, корональный, сагиттальный) и объёмный рендер vtk;
- пресеты цвета: bone, brain, vessels и другие. Это transfer function, не измерение ткани.

`lib/dicom-3d-processor.ts` считает память объёма и при необходимости вызывает `vtkImageResample`. Шаг в `estimateVolumeStats` всегда `[1,1,1]` и помечен как черновое значение. `components/Cinematic3DViewer.tsx` принимает те же `{ files, onClose }`.

Страница `app/ultrasound/page.tsx` этот viewer не импортирует. Она грузит картинку или кадры видео и отправляет их в разбор. Заявления «viewer уже умеет УЗ-объём» из этого кода не следует.

Общего типа объёма между Sono и Global нет. `Dicom3DViewer` не принимает готовую скалярную сетку, позы и маски покрытия.

## DICOM в Sono

`lib/dicom/pixel-spacing.ts` читает только `PixelSpacing` (0028,0030) и модальность (0008,0060). Анизотропия больше 2% делает шкалу непригодной для контура. US Region Calibration (0018,6011), тип области, физические единицы региона, NumberOfFrames и временные метки кадров не читаются. Файл DICOM в кабинете — источник шкалы для уже снятого кадра, не последовательность sweep.

## Персональные данные

| Путь | Куда уходят данные |
| --- | --- |
| Кадры исследования | Память вкладки, `useScanSession`. На диск исследование не пишется. |
| `POST /api/sono/diagnose` | Только по кнопке «Сформировать разбор». `lib/pipeline/diagnose.ts` закрашивает верхние 8%, нижние 12% и левый угол, затем PNG уходит в OpenRouter. |
| `POST /vision/frame` | Только если включён слой зрения. Облако вызывается при ключе. `gemini-vision-provider.ts` тоже закрашивает растр до PNG. |
| `POST /api/sono/forward-to-doctor-opus` | Явное действие. Синтетический источник отсекается. Тело — уже собранный результат, не сырой sweep. |
| Лог кадров | В памяти вкладки, согласие выключено, скачивание вручную. |
| Блок Sensorless freehand 3D | Считает локально, сеть не вызывает. |
| Global `Dicom3DViewer` | Файлы остаются в браузере для vtk. |
| Global `app/ultrasound` | Кадры уходят в API разбора этого продукта, это не Sono. |

## Таблица решений

| Кусок | Решение |
| --- | --- |
| `QualityScorer`, органы, Brain 1/2, арбитр | Переиспользовать. 3D их не подменяет. |
| `Mat4`, композиция, `dofToMatrix` | Адаптировать: добавить инверсию и тест направления осей. |
| `compoundVolume` | Не считать готовым этапом 1. Нет масок, лимит 32³, чёрный пиксель занимает воксель, одна шкала на оба направления. |
| `poseModelFromOnnx` | Заглушка. Не подключать к пациентскому sweep. |
| `Dicom3DViewer` | Не копировать. КТ/МРТ путь `files: File[]` не трогать. Позже отдельный вход уже собранной сетки. |
| `inspectDicomBuffer` | Адаптировать отдельным читателем US Region, не ломая текущий PixelSpacing для контура. |
| `UltrasoundStudy`, `FramePose`, `ReconstructedVolume`, `ReconstructionQC` | Разработать. Сейчас этих типов нет. |
| `ReferencePoseProvider` | Отсутствует. Эталонные `tforms` в репозитории нет. |
| Checkpoint TUS-REC | Отсутствует. Пока только отказ, без псевдообъёма. |
| ECG / выбор фазы / 4D | Отсутствует. |
| Python-обучение | Отсутствует. В CI не запускать. |

## Расхождение с планом ТЗ

Viewer Global складывает файлы в параллельный стек. Свободный проход датчика так укладывать нельзя: соседние кадры не являются срезами с постоянным Z. Минимальное изменение на будущее — не переписывать КТ/МРТ, а добавить второй вход зрителя: уже посчитанные скаляры, origin, spacing и direction. Пока такого входа нет, этап 1 может отдать объём и маски данными и проверить их тестами, не рисуя КТ-пресет поверх УЗ.

Шесть чисел ONNX-заглушки нельзя объявлять форматом официального checkpoint.

## Вопросы до этапа 1

1. Где лежит исследовательский sweep с `frames`, `tforms` и `calib_matrix.csv`, и можно ли его хранить вне git.
2. Система координат этих `tforms`: tracker→camera и image→tool нужно сверить с нашей `Mat4` (`p' = M·p`, `Rz·Ry·Rx`) на синтетической матрице, не на пациенте.
3. Зритель срезов на этапе 1 остаётся в Sono как проверка чисел, или сразу нужен второй вход в `Dicom3DViewer` в репозитории Global.

## Маленькие PR после подтверждения

1. Контракты `UltrasoundStudy`, `USFrame`, `FramePose`, `ReconstructedVolume`, `ReconstructionQC` и тест композиции с инверсией. Без сборки объёма пациента.
2. Чтение US Region Calibration отдельно от `PixelSpacing`. Нет шкалы — нет миллиметров.
3. `ReferencePoseProvider` только для теста. Эталонные матрицы не попадают в `runExperimental3d`.
4. Компаундирование с масками observed / interpolated / unknown и синтетические фантомы: шаг, поворот, пропуск, обратный проход.
5. Отказ `POSE_MODEL_UNAVAILABLE` вместо текущей заглушки, если кто-то ждёт объём без весов.
6. Только после этого — тонкий показ срезов. КТ/МРТ viewer не копировать.

Критерий этапа 1 из ТЗ: один эталонный неподвижный sweep даёт объём и срезы, синтетические тесты держат координаты и покрытие, unknown остаётся unknown, КТ/МРТ не ломаются.

Этап 2 и дальше не начинать, пока нет подтверждения этапа 1 и отдельного checkpoint. Веса TUS-REC не универсальный формат и не доказательство для пузыря, полой вены и сердца.
