'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadStage3A1Preview, type ReconstructionRecord, type Stage3A1Preview } from '@/benchmark/freehand3d/stage3a1'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { middleObservedIndex, orthogonalSlice, type OrthogonalSlice } from '@/lib/volume-engine/rendering/SliceRenderer'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

type StageView = 'ground-truth' | 'perfect' | 'registration' | 'difference' | 'coverage'

function show(value: MetricValue | number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? 'NOT AVAILABLE')
  return value.toFixed(2)
}

function surfaceOf(record: ReconstructionRecord): MetricValue {
  return record.discreteSurface.reconstructionToGroundTruth.meanMm
}

function paintDifference(slice: OrthogonalSlice): OrthogonalSlice {
  const rgba = new Uint8ClampedArray(slice.rgba)
  for (let pixel = 0; pixel < rgba.length; pixel += 4) {
    if ((rgba[pixel + 3] ?? 0) === 0) continue
    const tone = rgba[pixel] ?? 0
    const color = tone < 120 ? [62, 207, 176] : tone < 230 ? [230, 179, 90] : [255, 93, 93]
    rgba[pixel] = color[0] ?? 0
    rgba[pixel + 1] = color[1] ?? 0
    rgba[pixel + 2] = color[2] ?? 0
  }
  return { ...slice, rgba }
}

function SliceCanvas({ slice }: { slice: OrthogonalSlice }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || slice.width < 1 || slice.height < 1) return
    canvas.width = slice.width
    canvas.height = slice.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.putImageData(new ImageData(new Uint8ClampedArray(slice.rgba), canvas.width, canvas.height), 0, 0)
  }, [slice])
  return <canvas ref={ref} />
}

function volumeOf(preview: Stage3A1Preview, view: StageView): ReconstructedVolume {
  if (view === 'ground-truth') return preview.truth
  if (view === 'registration') return preview.registrationVolume
  if (view === 'difference') return preview.difference
  return preview.perfectVolume
}

export function Stage3APanel() {
  const { locale } = useLocale()
  const ru = locale === 'ru'
  const [preview, setPreview] = useState<Stage3A1Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<StageView>('perfect')
  useEffect(() => {
    void loadStage3A1Preview().then(setPreview).catch(() => setFailed(true))
  }, [])
  const labels: Record<StageView, string> = {
    'ground-truth': ru ? 'Эталон' : 'Ground truth',
    perfect: ru ? 'Точная поза' : 'Perfect pose',
    registration: ru ? 'Регистрация' : 'Registration',
    difference: ru ? 'Различие' : 'Difference',
    coverage: ru ? 'Покрытие' : 'Coverage',
  }
  const current = preview ? volumeOf(preview, view) : null
  const perfect = preview?.perfect
  const registration = preview?.registration
  return (
    <main className="shell ultra">
      <header className="home-hero">
        <div>
          <p className="brand" aria-label="SonOpus ultra">
            <Link href="/">Son<span className="brand-opus">Opus</span><span className="brand-mark">ultra</span></Link>
          </p>
          <h1>Stage 3A.1</h1>
        </div>
        <div className="top-tools">
          <LanguageSwitch />
          <Link href="/freehand">{ru ? 'Freehand 3D' : 'Freehand 3D'}</Link>
        </div>
      </header>
      <section className="panel freehand">
        <p className="banner warn">STAGE 3A.1. EXPERIMENTAL. Clinical validation: NO. TUS-REC: NOT CONNECTED.</p>
        <p>{ru
          ? 'Сфера, проход по Z, RAW-кадры 32×32. Эталон вокселей строится отдельно от сборки. Полная матрица записана в stage3a1.'
          : 'Sphere, Z sweep, RAW 32×32 frames. Voxel truth is built apart from the reconstruction. The full matrix is in stage3a1.'}</p>
        {preview && perfect && registration && current ? (
          <>
            <div className="metrics freehand-metrics">
              <div>
                <strong>{preview.voxelOccupied}</strong>
                <span>{ru ? 'Voxel truth, воксели' : 'Voxel truth, voxels'}</span>
              </div>
              <div>
                <strong>{show(preview.analyticDiscrepancyPercent)}%</strong>
                <span>{ru ? 'Voxel против аналитического объёма' : 'Voxel vs analytic volume'}</span>
              </div>
              <div>
                <strong>{perfect.generatedFrames} / {perfect.usedFrames} / {perfect.trimmedFrames}</strong>
                <span>{ru ? 'Сгенерировано / RAW / TRIMMED' : 'Generated / RAW / TRIMMED'}</span>
              </div>
            </div>
            <div className="metrics freehand-metrics">
              <div>
                <strong>{show(perfect.dice)} / {show(perfect.iou)}</strong>
                <span>{ru ? 'Точная поза: Dice / IoU' : 'Perfect pose: Dice / IoU'}</span>
              </div>
              <div>
                <strong>{show(surfaceOf(perfect))} мм</strong>
                <span>{ru ? 'Точная поза: поверхность' : 'Perfect pose: surface'}</span>
              </div>
              <div>
                <strong>{show(perfect.volumeErrorVsVoxelTruthPercent)}% / {show(perfect.volumeErrorVsAnalyticTruthPercent)}%</strong>
                <span>{ru ? 'Объём vs voxel / analytic' : 'Volume vs voxel / analytic'}</span>
              </div>
              <div>
                <strong>{show(registration.dice)} / {show(registration.iou)}</strong>
                <span>{ru ? 'Регистрация: Dice / IoU' : 'Registration: Dice / IoU'}</span>
              </div>
              <div>
                <strong>{show(surfaceOf(registration))} мм</strong>
                <span>{ru ? 'Регистрация: поверхность' : 'Registration: surface'}</span>
              </div>
              <div>
                <strong>{show(registration.pose.drift.knownAxesTranslationMm)} / {show(registration.pose.drift.placementTranslationMm)} мм</strong>
                <span>{ru ? 'Drift известных осей / placement' : 'Known-axis drift / placement'}</span>
              </div>
            </div>
            <h2>{ru ? 'Поза' : 'Pose'}</h2>
            {registration.error ? <p className="hint">RAW registration: {registration.error}. {ru ? 'Отклонено кадров' : 'Rejected frames'}: {registration.rejectedFrames}.</p> : null}
            <div className="metrics freehand-metrics">
              <div><strong>{show(registration.pose.local.meanTranslationMm)} мм</strong><span>{ru ? 'Локальная, средняя' : 'Local mean'}</span></div>
              <div><strong>{show(registration.pose.global.meanTranslationMm)} мм</strong><span>{ru ? 'Глобальная, средняя' : 'Global mean'}</span></div>
              <div><strong>{show(registration.pose.global.maxTranslationMm)} мм</strong><span>{ru ? 'Глобальная, максимум' : 'Global max'}</span></div>
              <div><strong>{show(registration.pose.local.translationZMm)}</strong><span>Z</span></div>
              <div><strong>{show(registration.pose.drift.rotationDeg)}</strong><span>{ru ? 'Поворот' : 'Rotation'}</span></div>
              <div><strong>{show(registration.centroidErrorMm)} мм</strong><span>{ru ? 'Центроид регистрации' : 'Registration centroid'}</span></div>
            </div>
            <div className="actions">
              {(Object.keys(labels) as StageView[]).map((item) => (
                <button key={item} type="button" className={item === view ? 'primary' : 'ghost'} onClick={() => setView(item)}>{labels[item]}</button>
              ))}
            </div>
            {view === 'difference' ? (
              <ul className="bench-legend">
                <li><i className="swatch match" />MATCH 0.25</li>
                <li><i className="swatch fn" />FALSE NEGATIVE 0.75</li>
                <li><i className="swatch fp" />FALSE POSITIVE 1</li>
              </ul>
            ) : null}
            {current.size[0] > 0 ? (
              <div className="freehand-slices">
                {(['z', 'y', 'x'] as const).map((axis) => (
                  <figure key={axis}>
                    <SliceCanvas slice={view === 'difference'
                      ? paintDifference(orthogonalSlice(current, axis, middleObservedIndex(current, axis)))
                      : orthogonalSlice(current, axis, middleObservedIndex(current, axis), view === 'coverage' ? 'coverage' : 'observed')} />
                    <figcaption>{axis}</figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="hint">{ru ? 'В этом виде сетка пустая.' : 'This view has an empty grid.'}</p>}
            <table className="bench-table">
              <caption>{ru ? 'Внесённый сдвиг позы → сборка. Это не измеренная ошибка позы.' : 'Injected pose shift → reconstruction. This is not the measured pose error.'}</caption>
              <thead>
                <tr>
                  <th>{ru ? 'Внесено, мм' : 'Injected, mm'}</th>
                  <th>{ru ? 'Локальная, мм' : 'Local, mm'}</th>
                  <th>{ru ? 'Глобальная, мм' : 'Global, mm'}</th>
                  <th>Dice</th>
                  <th>{ru ? 'Поверхность, мм' : 'Surface, mm'}</th>
                  <th>{ru ? 'Объём vs voxel, %' : 'Volume vs voxel, %'}</th>
                </tr>
              </thead>
              <tbody>
                {preview.poseBias.map((row) => (
                  <tr key={row.injectedTranslationMm}>
                    <td>{row.injectedTranslationMm}</td>
                    <td>{show(row.pose.local.meanTranslationMm)}</td>
                    <td>{show(row.pose.drift.knownAxesTranslationMm)}</td>
                    <td>{show(row.dice)}</td>
                    <td>{show(surfaceOf(row))}</td>
                    <td>{show(row.volumeErrorVsVoxelTruthPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="bench-table">
              <caption>{ru ? 'Dropout, точная поза, проход X' : 'Dropout, perfect pose, X sweep'}</caption>
              <thead>
                <tr>
                  <th>{ru ? 'Отброшено' : 'Dropped'}</th>
                  <th>{ru ? 'В сборке' : 'Used'}</th>
                  <th>Dice</th>
                  <th>IoU</th>
                  <th>{ru ? 'Поверхность, мм' : 'Surface, mm'}</th>
                </tr>
              </thead>
              <tbody>
                {preview.dropout.map((row) => (
                  <tr key={row.droppedFrames}>
                    <td>{row.droppedFrames}</td>
                    <td>{row.usedFrames}</td>
                    <td>{show(row.dice)}</td>
                    <td>{show(row.iou)}</td>
                    <td>{show(surfaceOf(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="bench-table">
              <caption>{ru ? 'Шум изображения, точная поза. Геометрия эталона не меняется.' : 'Image noise, perfect pose. Ground-truth geometry stays the same.'}</caption>
              <thead>
                <tr>
                  <th>{ru ? 'Изображение' : 'Image'}</th>
                  <th>{ru ? 'Поза' : 'Pose'}</th>
                  <th>Dice</th>
                  <th>{ru ? 'Поверхность, мм' : 'Surface, mm'}</th>
                </tr>
              </thead>
              <tbody>
                {preview.noise.map((row) => (
                  <tr key={row.imageCondition}>
                    <td>{row.imageCondition}</td>
                    <td>{row.poseCondition}</td>
                    <td>{show(row.dice)}</td>
                    <td>{show(surfaceOf(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="bench-table">
              <caption>{ru ? 'Шаг вокселя и stride, точная поза' : 'Voxel spacing and stride, perfect pose'}</caption>
              <thead>
                <tr>
                  <th>{ru ? 'Шаг, мм' : 'Spacing, mm'}</th>
                  <th>Stride</th>
                  <th>Dice</th>
                  <th>IoU</th>
                  <th>{ru ? 'Поверхность, мм' : 'Surface, mm'}</th>
                  <th>{ru ? 'Время, мс' : 'Runtime, ms'}</th>
                </tr>
              </thead>
              <tbody>
                {preview.spacing.map((row) => (
                  <tr key={`spacing-${row.voxelSpacingMm}`}>
                    <td>{row.voxelSpacingMm}</td>
                    <td>{row.stride}</td>
                    <td>{show(row.dice)}</td>
                    <td>{show(row.iou)}</td>
                    <td>{show(surfaceOf(row))}</td>
                    <td>{show(row.totalMs)}</td>
                  </tr>
                ))}
                {preview.stride.filter((row) => row.stride !== 1).map((row) => (
                  <tr key={`stride-${row.stride}`}>
                    <td>{row.voxelSpacingMm}</td>
                    <td>{row.stride}</td>
                    <td>{show(row.dice)}</td>
                    <td>{show(row.iou)}</td>
                    <td>{show(surfaceOf(row))}</td>
                    <td>{show(row.totalMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p className="hint">{failed ? (ru ? 'Прогон не собрался.' : 'The run did not finish.') : (ru ? 'Считается прогон сферы.' : 'Running the sphere case.')}</p>}
      </section>
    </main>
  )
}
