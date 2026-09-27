'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadStage3APreview, type Stage3APreview } from '@/benchmark/freehand3d/stage3a'
import type { MetricValue } from '@/benchmark/freehand3d/phantoms/metrics'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { middleObservedIndex, orthogonalSlice, type OrthogonalSlice } from '@/lib/volume-engine/rendering/SliceRenderer'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

type StageView = 'ground-truth' | 'perfect' | 'registration' | 'difference' | 'coverage'

function show(value: MetricValue | number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? 'NOT AVAILABLE')
  return value.toFixed(2)
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

function volumeOf(preview: Stage3APreview, view: StageView): ReconstructedVolume {
  if (view === 'ground-truth') return preview.groundTruth
  if (view === 'registration') return preview.registrationVolume
  if (view === 'difference') return preview.difference
  return preview.perfectVolume
}

export function Stage3APanel() {
  const { locale } = useLocale()
  const ru = locale === 'ru'
  const [preview, setPreview] = useState<Stage3APreview | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<StageView>('perfect')
  useEffect(() => {
    void loadStage3APreview().then(setPreview).catch(() => setFailed(true))
  }, [])
  const labels: Record<StageView, string> = {
    'ground-truth': ru ? 'Эталон' : 'Ground truth',
    perfect: ru ? 'Точная поза' : 'Perfect pose',
    registration: ru ? 'Регистрация' : 'Registration',
    difference: ru ? 'Различие' : 'Difference',
    coverage: ru ? 'Покрытие' : 'Coverage',
  }
  const current = preview ? volumeOf(preview, view) : null
  return (
    <main className="shell ultra">
      <header className="home-hero">
        <div>
          <p className="brand" aria-label="SonOpus ultra">
            <Link href="/">Son<span className="brand-opus">Opus</span><span className="brand-mark">ultra</span></Link>
          </p>
          <h1>Stage 3A Benchmark</h1>
        </div>
        <div className="top-tools">
          <LanguageSwitch />
          <Link href="/freehand">{ru ? 'Freehand 3D' : 'Freehand 3D'}</Link>
        </div>
      </header>
      <section className="panel freehand">
        <p className="banner warn">EXPERIMENTAL. Physical measurements: DISABLED. Clinical validation: NO. TUS-REC: NOT CONNECTED.</p>
        <p>{ru ? 'Сфера, проход по Z, кадр 32×32. В сборку попадают кадры со сечением объекта. Полная матрица записана в отчёте.' : 'Sphere, Z sweep, 32×32 frames. The build keeps frames that cut the object. The full matrix is in the report.'}</p>
        {preview && current && current.size[0] > 0 ? (
          <>
            <div className="metrics freehand-metrics">
              <div><strong>{preview.phantom}</strong><span>{ru ? 'Фантом' : 'Phantom'}</span></div>
              <div><strong>{preview.frames}</strong><span>{ru ? 'Кадры' : 'Frames'}</span></div>
              <div><strong>{view === 'registration' ? 'registration' : view === 'ground-truth' ? 'ground truth' : view === 'difference' ? 'difference' : view === 'coverage' ? 'coverage' : 'perfect'}</strong><span>{ru ? 'Режим позы' : 'Pose mode'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.totalTranslationErrorMm : preview.perfect.poseErrorMm)}</strong><span>{ru ? 'Ошибка позы, мм' : 'Pose error, mm'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.coverage : preview.perfect.coverage)}</strong><span>{ru ? 'Покрытие сетки' : 'Grid coverage'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.surfaceMeanDistanceMm : preview.perfect.surfaceMeanDistanceMm)}</strong><span>{ru ? 'Ошибка поверхности, мм' : 'Surface error, mm'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.dimensionErrorPercent : preview.perfect.dimensionErrorPercent)}</strong><span>{ru ? 'Ошибка размера, %' : 'Dimension error, %'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.wallTimeMs : preview.perfect.wallTimeMs)}</strong><span>{ru ? 'Время, мс' : 'Runtime, ms'}</span></div>
              <div><strong>{show(view === 'registration' ? preview.registration.memoryBytes : preview.perfect.memoryBytes)}</strong><span>{ru ? 'Память, байт' : 'Memory, bytes'}</span></div>
            </div>
            <p>POSE Z: {preview.registration.translationErrorZMm}. ROTATION: {preview.registration.rotation}.</p>
            <div className="actions">
              {(Object.keys(labels) as StageView[]).map((item) => (
                <button key={item} type="button" className={item === view ? 'primary' : 'ghost'} onClick={() => setView(item)}>{labels[item]}</button>
              ))}
            </div>
            <div className="freehand-slices">
              {(['z', 'y', 'x'] as const).map((axis) => (
                <figure key={axis}>
                  <SliceCanvas slice={orthogonalSlice(current, axis, middleObservedIndex(current, axis), view === 'coverage' ? 'coverage' : 'observed')} />
                  <figcaption>{axis}</figcaption>
                </figure>
              ))}
            </div>
            <table className="bench-table">
              <thead>
                <tr>
                  <th>{ru ? 'Сдвиг по Z, мм' : 'Z shift, mm'}</th>
                  <th>{ru ? 'Поверхность, мм' : 'Surface, mm'}</th>
                  <th>{ru ? 'Размер, %' : 'Dimension, %'}</th>
                  <th>{ru ? 'Объём, %' : 'Volume, %'}</th>
                </tr>
              </thead>
              <tbody>
                {preview.sensitivity.map((row) => (
                  <tr key={row.injectedTranslationMm}>
                    <td>{row.injectedTranslationMm}</td>
                    <td>{show(row.surfaceMeanDistanceMm)}</td>
                    <td>{show(row.dimensionErrorPercent)}</td>
                    <td>{show(row.volumeErrorPercent)}</td>
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
