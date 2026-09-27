'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { loadExperimentalDesk, type ExperimentalDesk } from '@/lib/volume-engine/demo'
import { middleObservedIndex, orthogonalSlice, type OrthogonalSlice, type SliceView } from '@/lib/volume-engine/rendering/SliceRenderer'
import type { VolumeBuildResult } from '@/lib/volume-engine/core/VolumeEngine'
import { coverageRatio } from '@/lib/volume-engine/reconstruction/CoverageMap'

function SliceCanvas({ slice }: { slice: OrthogonalSlice }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = Math.max(1, slice.width)
    canvas.height = Math.max(1, slice.height)
    const context = canvas.getContext('2d')
    if (!context) return
    context.putImageData(new ImageData(new Uint8ClampedArray(slice.rgba), canvas.width, canvas.height), 0, 0)
  }, [slice])
  return <canvas ref={ref} />
}

function TrajectorySketch({ points }: { points: readonly [number, number, number][] }) {
  if (points.length === 0) return null
  const xs = points.map((point) => point[0])
  const zs = points.map((point) => point[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const spanX = Math.max(1, maxX - minX)
  const spanZ = Math.max(1, maxZ - minZ)
  const line = points.map((point) => {
    const x = 16 + ((point[0] - minX) / spanX) * 280
    const y = 140 - ((point[2] - minZ) / spanZ) * 110
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className="trajectory-svg" viewBox="0 0 320 160" role="img">
      <polyline points={line} fill="none" stroke="#3ecfb0" strokeWidth="3" />
    </svg>
  )
}

function percent(volume: VolumeBuildResult['volume']): number {
  return Math.round(coverageRatio(volume.observed) * 100)
}

export function Freehand3DScreen() {
  const { locale } = useLocale()
  const ru = locale === 'ru'
  const [desk, setDesk] = useState<ExperimentalDesk | null>(null)
  const [view, setView] = useState<SliceView>('observed')
  useEffect(() => {
    void loadExperimentalDesk().then(setDesk)
  }, [])
  const registration = desk?.registration
  const reference = desk?.reference
  return (
    <main className="shell ultra">
      <header className="home-hero">
        <div>
          <p className="brand" aria-label="SonOpus ultra">
            <Link href="/">Son<span className="brand-opus">Opus</span><span className="brand-mark">ultra</span></Link>
          </p>
          <h1>Freehand 3D</h1>
        </div>
        <div className="top-tools">
          <LanguageSwitch />
          <Link href="/">{ru ? 'Назад' : 'Back'}</Link>
        </div>
      </header>
      <section className="panel freehand">
        <h2>{ru ? 'Эталонный тестовый объём' : 'Reference test volume'}</h2>
        <p>{ru ? 'Синтетическая геометрия для проверки сетки. Это не исследование пациента.' : 'Synthetic geometry for the grid check. This is not a patient study.'}</p>
        {reference && desk ? (
          <>
            <div className="metrics freehand-metrics">
              <div><strong>{reference.telemetry.frame_count}</strong><span>{ru ? 'Кадры' : 'Frames'}</span></div>
              <div><strong>{reference.acceptedFrames}</strong><span>{ru ? 'Принято' : 'Accepted'}</span></div>
              <div><strong>{reference.rejectedFrames}</strong><span>{ru ? 'Отклонено' : 'Rejected'}</span></div>
              <div><strong>reference</strong><span>{ru ? 'Поза' : 'Pose'}</span></div>
              <div><strong>{reference.telemetry.trajectory_length.toFixed(0)} mm</strong><span>{ru ? 'Траектория' : 'Trajectory'}</span></div>
              <div><strong>{percent(reference.volume)}%</strong><span>{ru ? 'Покрытие' : 'Coverage'}</span></div>
            </div>
            <p className="banner ok">REFERENCE VALIDATED. Clinical validation: NO.</p>
            <div className="actions">
              <button type="button" onClick={() => setView('observed')}>{ru ? 'Только наблюдения' : 'Observed only'}</button>
              <button type="button" onClick={() => setView('coverage')}>{ru ? 'Покрытие' : 'Coverage'}</button>
            </div>
            <TrajectorySketch points={desk.referenceView.trajectory} />
            <div className="freehand-slices">
              {(['z', 'y', 'x'] as const).map((axis, index) => (
                <figure key={axis}>
                  <SliceCanvas slice={orthogonalSlice(reference.volume, axis, middleObservedIndex(reference.volume, axis), view)} />
                  <figcaption>{[ru ? 'Аксиальный' : 'Axial', ru ? 'Корональный' : 'Coronal', ru ? 'Сагиттальный' : 'Sagittal'][index]}</figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : <p className="hint">{ru ? 'Собирается тестовый объём.' : 'Building the test volume.'}</p>}
      </section>
      <section className="panel freehand">
        <h2>{ru ? 'Регистрация соседних кадров' : 'Neighbor-frame registration'}</h2>
        <p className="banner warn">EXPERIMENTAL ESTIMATED. Physical measurements: DISABLED. Clinical validation: NO.</p>
        <p>POSE: 2D REGISTRATION. OUT-OF-PLANE: NOT ESTIMATED.</p>
        <p>{ru ? 'Вне плоскости движение не оценено. Ноль по этой оси — не измерение.' : 'Out-of-plane motion is not estimated. Zero on that axis is not a measurement.'}</p>
        {registration ? (
          <div className="metrics freehand-metrics">
            <div><strong>{registration.telemetry.frame_count}</strong><span>{ru ? 'Кадры' : 'Frames'}</span></div>
            <div><strong>{registration.acceptedFrames}</strong><span>{ru ? 'Принято' : 'Accepted'}</span></div>
            <div><strong>{registration.rejectedFrames}</strong><span>{ru ? 'Отклонено' : 'Rejected'}</span></div>
            <div><strong>registration</strong><span>{ru ? 'Поза' : 'Pose'}</span></div>
            <div><strong>{registration.telemetry.mean_pose_confidence.toFixed(2)}</strong><span>{ru ? 'Уверенность позы' : 'Pose confidence'}</span></div>
            <div><strong>{registration.telemetry.trajectory_length.toFixed(0)} mm</strong><span>{ru ? 'Траектория' : 'Trajectory'}</span></div>
            <div><strong>{percent(registration.volume)}%</strong><span>{ru ? 'Покрытие' : 'Coverage'}</span></div>
            <div><strong>EXPERIMENTAL</strong><span>{ru ? 'Статус объёма' : 'Volume status'}</span></div>
          </div>
        ) : null}
      </section>
      <section className="panel freehand">
        <h2>TUS-REC</h2>
        <p className="banner warn">LEARNED POSE: MODEL NOT CONNECTED</p>
        <p>{ru ? 'Модель не подключена. Объём из неё не строится.' : 'The model is not connected. No volume is built from it.'}</p>
        <p className="hint">{desk ? desk.tusRec.missing.join(', ') : 'checkpoint'}</p>
      </section>
    </main>
  )
}
