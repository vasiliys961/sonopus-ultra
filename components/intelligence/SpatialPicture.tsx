'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/components/LocaleProvider'
import { aiFrameBudget, type AIFrameBudget } from '@/engine/ai/frame-budget'
import { atlasTitle } from '@/engine/atlas/catalog'
import { obliqueSlice } from '@/engine/medical-3d/oblique-slice'
import { frameShift, type FramePair, type NormPoint } from '@/engine/registration/frame-shift'
import { buildStudyOffThread } from '@/engine/study/off-thread'
import { decodeBudget } from '@/engine/cine/cine-decoder'
import { VtkReslice } from '@/components/intelligence/VtkReslice'
import { VtkVolume } from '@/components/intelligence/VtkVolume'
import { readCrossSeries, type CrossSeries } from '@/lib/dicom/cross-section'
import { framesFromVideo } from '@/components/intelligence/decode-video'
import { probeTravel } from '@/lib/intelligence/parallel-stack'
import { axialIndexForDepth, cineIndexForAxial } from '@/lib/intelligence/stack-link'
import { projectObserved, type VolumePicture } from '@/lib/intelligence/project-volume'
import { fitGray } from '@/lib/intelligence/gray'
import type { SpatialPreview } from '@/lib/intelligence/build-preview'
import type { CineFrame } from '@/lib/intelligence/sample-cine'
import { rasterToGray } from '@/lib/quality/gray'
import { jpegToRaster } from '@/lib/ultra/frame-jpeg'
import { evenSample } from '@/lib/ultra/pass-loop'
import { crosshairFromClick, middleObservedIndex, orthogonalSlice, pointOnPlane, type OrthogonalSlice, type SliceAxis } from '@/lib/volume-engine/rendering/SliceRenderer'
import type { LesionCandidate } from '@/types/pathology'
import type { UltrasoundStudy } from '@/types/study'

interface PassFrame {
  jpeg: string
  qualityScore: number
  timestamp: number
  sequenceNumber: number
}

type Phase = 'idle' | 'building' | 'ready' | 'failed'
type PictureView = 'cine' | 'mpr' | 'volume' | 'pathology' | 'report' | 'fusion'

export function SpatialPicture({ frames, organId = 'liver' }: { frames: readonly PassFrame[]; organId?: string }) {
  const { locale } = useLocale()
  const ru = locale === 'ru'
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<SpatialPreview | null>(null)
  const [study, setStudy] = useState<UltrasoundStudy | null>(null)
  const [budget, setBudget] = useState<AIFrameBudget | null>(null)
  const [failure, setFailure] = useState('')
  const [axes, setAxes] = useState<Record<SliceAxis, number>>({ x: 0, y: 0, z: 0 })
  const [yaw, setYaw] = useState(35)
  const [tilt, setTilt] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [important, setImportant] = useState<string[]>([])
  const [view, setView] = useState<PictureView>('mpr')
  const [series, setSeries] = useState<CrossSeries | null>(null)
  const [crossIndex, setCrossIndex] = useState(0)
  const [crossNote, setCrossNote] = useState('')
  const [crossMode, setCrossMode] = useState<'hidden' | 'alone' | 'beside'>('hidden')
  const [pairs, setPairs] = useState<FramePair[]>([])
  const [draftUs, setDraftUs] = useState<NormPoint | null>(null)
  const [draft, setDraft] = useState<{ gray: Float32Array; width: number; height: number }[]>([])
  const [cineIndex, setCineIndex] = useState(0)
  const cineLock = useRef(false)
  const request = useRef(0)

  async function publish(cine: CineFrame[], ticket: number) {
    const built = await buildStudyOffThread(cine, organId)
    if (request.current !== ticket) return
    setPreview(built.preview)
    setStudy(built.study)
    setBudget(built.budget)
    setFocusId(null)
    setImportant([])
    setTilt(0)
    setAxes({
      x: middleObservedIndex(built.preview.volume, 'x'),
      y: middleObservedIndex(built.preview.volume, 'y'),
      z: middleObservedIndex(built.preview.volume, 'z'),
    })
    setPhase(built.preview.accepted > 0 ? 'ready' : 'failed')
    if (built.preview.accepted > 0) setView('mpr')
    if (built.preview.accepted === 0) setFailure(built.preview.note)
  }

  async function build() {
    const ticket = request.current + 1
    request.current = ticket
    setPhase('building')
    setFailure('')
    try {
      const duration = frames.length > 1 ? frames[frames.length - 1].timestamp - frames[0].timestamp : 0
      const pool = evenSample([...frames], decodeBudget(duration, frames.length))
      const cine: CineFrame[] = []
      for (const shot of pool) {
        if (!shot.jpeg) continue
        const raster = await jpegToRaster(shot.jpeg)
        const gray = rasterToGray(raster)
        cine.push({
          id: `pass-${shot.sequenceNumber}`,
          timestamp: shot.timestamp,
          quality: shot.qualityScore,
          plane: fitGray(gray, raster.width, raster.height),
        })
      }
      setDraft(cine.slice(0, 8).map((frame) => frame.plane))
      await publish(cine, ticket)
    } catch (error) {
      if (request.current !== ticket) return
      setPhase('failed')
      setFailure(error instanceof Error ? error.message : (ru ? 'Картина не собралась.' : 'The picture was not built.'))
    }
  }

  async function loadCross(files: readonly File[]) {
    setCrossNote('')
    try {
      const parts = await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())))
      const read = readCrossSeries(parts)
      if (!read.series) {
        setSeries(null)
        setCrossIndex(0)
        setCrossMode('hidden')
        setCrossNote(read.reason ?? (ru ? 'Снимок не прочитался.' : 'The scan was not read.'))
        return
      }
      setSeries(read.series)
      setCrossIndex(0)
      setPairs([])
      setDraftUs(null)
      setCrossMode('alone')
    } catch (error) {
      setSeries(null)
      setCrossIndex(0)
      setCrossMode('hidden')
      setCrossNote(error instanceof Error ? error.message : (ru ? 'Снимок не прочитался.' : 'The scan was not read.'))
    }
  }

  async function buildFile(file: File) {
    const ticket = request.current + 1
    request.current = ticket
    setPhase('building')
    setFailure('')
    try {
      const cine = await framesFromVideo(file)
      setDraft(cine.slice(0, 8).map((frame) => frame.plane))
      await publish(cine, ticket)
    } catch (error) {
      if (request.current !== ticket) return
      setPhase('failed')
      setFailure(error instanceof Error ? error.message : (ru ? 'Видео не прочиталось.' : 'The video was not read.'))
    }
  }

  const volume = preview?.volume
  const focus = study?.candidates.find((item) => item.id === focusId) ?? null
  const shownBudget = study
    ? aiFrameBudget(
      study.frames.map((frame) => frame.id),
      [...study.candidates.flatMap((item) => item.provenance.frames), ...important],
    )
    : budget

  useEffect(() => {
    if (!preview || !volume) return
    if (cineLock.current) {
      cineLock.current = false
      return
    }
    setCineIndex(cineIndexForAxial(preview.slices, volume.originMm[2], volume.spacingMm[2], axes.z))
  }, [axes.z, preview, volume])

  function followCine(index: number) {
    const count = preview?.slices.length ?? 0
    const next = count === 0 ? 0 : Math.max(0, Math.min(count - 1, index))
    setCineIndex(next)
    const slice = preview?.slices[next]
    if (!slice || !volume) return
    const z = axialIndexForDepth(volume.originMm[2], volume.spacingMm[2], volume.size[2], slice.depth)
    if (axes.z === z) return
    cineLock.current = true
    setAxes((current) => ({ ...current, z }))
  }

  function toggleImportant(id: string) {
    setImportant((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }
  const slices = volume && phase === 'ready'
    ? (['z', 'y', 'x'] as const).map((axis) => orthogonalSlice(volume, axis, axes[axis] ?? 0, 'observed'))
    : []
  const shift = slices[0] ? frameShift(pairs, slices[0].width, slices[0].height) : null
  const picture = volume && phase === 'ready' ? projectObserved(volume, (yaw * Math.PI) / 180) : null
  const oblique = volume && phase === 'ready' && focus
    ? obliqueSlice(volume, focus.location, (tilt * Math.PI) / 180)
    : null

  function placeCandidate(item: LesionCandidate, target: 'slice' | 'cine' | 'volume') {
    if (!volume) return
    setFocusId(item.id)
    setView(target === 'slice' ? 'mpr' : target === 'cine' ? 'cine' : 'volume')
    setAxes({
      x: clampIndex(item.location.x, volume.size[0]),
      y: clampIndex(item.location.y, volume.size[1]),
      z: clampIndex(item.location.z, volume.size[2]),
    })
    const node = document.getElementById(target === 'volume' ? 'spatial-vtk' : target === 'cine' ? 'spatial-cine' : 'spatial-mpr')
    node?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <section className="spatial-picture">
      <h2>{ru ? 'Пространственная картина' : 'Spatial picture'}</h2>
      <p className="hint">
        {ru
          ? `В петле ${frames.length} кадров. Они раскладываются в параллельные срезы и собираются в объём. Глубина оценена по смене картинки, это не датчик положения. Миллиметры пациента здесь не измеряются.`
          : `${frames.length} frames in the loop. They are laid into parallel slices and built into a volume. Depth is estimated from the picture change, not from a position sensor. Patient millimetres are not measured here.`}
      </p>
      <div className="actions">
        <button type="button" className="primary" disabled={frames.length < 2 || phase === 'building'} onClick={() => void build()}>
          {phase === 'building' ? (ru ? 'Собирается' : 'Building') : (ru ? 'Собрать картину' : 'Build the picture')}
        </button>
        <label className="ghost file-pick">
          {ru ? 'Видеофайл' : 'Video file'}
          <input
            type="file"
            accept="video/*"
            disabled={phase === 'building'}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void buildFile(file)
            }}
          />
        </label>
      </div>
      {failure ? <p className="banner bad">{failure}</p> : null}
      {phase === 'building' && draft.length > 0 ? (
        <div id="spatial-draft">
          <p className="hint">
            {ru
              ? `Кадры уже прочитаны, показаны первые ${draft.length}. Объём ещё собирается.`
              : `Frames are read. The first ${draft.length} are shown. The volume is still building.`}
          </p>
          <div className="cine-strip">
            {draft.map((frame, index) => (
              <GrayThumb key={index} gray={frame.gray} width={frame.width} height={frame.height} />
            ))}
          </div>
        </div>
      ) : null}
      {preview && phase === 'ready' ? (
        <>
          <p className="banner">{preview.note}</p>
          <div className="metrics freehand-metrics">
            <div><strong>{frames.length}</strong><span>{ru ? 'Кадры петли' : 'Loop frames'}</span></div>
            <div><strong>{preview.kept}</strong><span>{ru ? 'Взято в объём' : 'Used'}</span></div>
            <div><strong>{preview.accepted}</strong><span>{ru ? 'Принято' : 'Accepted'}</span></div>
            <div><strong>{Math.round(preview.coverage * 100)}%</strong><span>{ru ? 'Покрытие сетки' : 'Grid coverage'}</span></div>
          </div>
          <p className="hint">{ru ? 'Клинически не проверено. Диагноз по объёму пока не ставится.' : 'Not clinically validated. The volume is not read as a diagnosis yet.'}</p>
          <div className="actions" role="tablist">
            {([
              ['cine', ru ? 'Кино' : 'Cine'],
              ['mpr', ru ? 'Срезы' : 'Slices'],
              ['volume', ru ? 'Объём' : 'Volume'],
              ['pathology', ru ? 'Патология' : 'Pathology'],
              ['report', ru ? 'Отчёт' : 'Report'],
              ['fusion', ru ? 'Слияние' : 'Fusion'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'primary' : 'ghost'} onClick={() => setView(id)}>
                {label}
              </button>
            ))}
          </div>
          {view === 'volume' && picture ? (
            <figure className="spatial-volume">
              <PictureCanvas picture={picture} />
              <figcaption>{ru ? 'Объём, проекция максимума' : 'Volume, maximum projection'}</figcaption>
              <label className="row">
                {ru ? 'Поворот' : 'Turn'}
                <input type="range" min={0} max={180} value={yaw} onChange={(event) => setYaw(Number(event.target.value))} />
              </label>
            </figure>
          ) : null}
          {view === 'cine' && study ? (
            <CineStrip
              study={study}
              preview={preview}
              focus={focus}
              ru={ru}
              budget={shownBudget}
              important={important}
              index={cineIndex}
              linked={volume ? `${ru ? 'Аксиальный' : 'Axial'} ${axes.z + 1}/${volume.size[2]}` : ''}
              onIndex={followCine}
              onToggle={toggleImportant}
            />
          ) : null}
          {view === 'cine' && preview ? (
            <p className="hint">{probeLine(probeTravel(preview.slices), ru)}</p>
          ) : null}
          {view === 'mpr' ? (
          <>
          <div id="spatial-mpr" className="freehand-slices">
            {slices.map((slice) => {
              const count = slice.axis === 'x' ? preview.volume.size[0] : slice.axis === 'y' ? preview.volume.size[1] : preview.volume.size[2]
              const crosshair = pointOnPlane(slice.axis, axes)
              return (
              <figure key={slice.axis}>
                <SliceCanvas
                  slice={slice}
                  crosshair={crosshair}
                  marker={focus ? pointOnPlane(slice.axis, focus.location) : null}
                  onPick={(col, row) => setAxes((current) => crosshairFromClick(slice.axis, clampIndex(col, slice.width), clampIndex(row, slice.height), current))}
                  onStep={(delta) => setAxes((current) => ({ ...current, [slice.axis]: clampIndex((current[slice.axis] ?? 0) + delta, count) }))}
                />
                <figcaption>
                  {{ z: ru ? 'Аксиальный' : 'Axial', y: ru ? 'Корональный' : 'Coronal', x: ru ? 'Сагиттальный' : 'Sagittal' }[slice.axis]}
                  {' · RECONSTRUCTED · '}{(axes[slice.axis] ?? 0) + 1}/{count}
                  {slice.axis === 'z' && preview.slices.length > 0 ? ` · ${ru ? 'кадр' : 'frame'} ${Math.min(cineIndex, preview.slices.length - 1) + 1}/${preview.slices.length}` : ''}
                </figcaption>
                <label className="row">
                  {ru ? 'Срез' : 'Slice'}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, count - 1)}
                    value={axes[slice.axis] ?? 0}
                    onChange={(event) => setAxes((current) => ({ ...current, [slice.axis]: Number(event.target.value) }))}
                  />
                </label>
              </figure>
              )
            })}
            {oblique ? (
              <figure>
                <SliceCanvas slice={{ axis: 'z', index: 0, width: oblique.width, height: oblique.height, rgba: oblique.rgba }} />
                <figcaption>{ru ? 'Косой' : 'Oblique'} · {oblique.kind}</figcaption>
                <label className="row">
                  {ru ? 'Наклон' : 'Tilt'}
                  <input type="range" min={0} max={60} value={tilt} onChange={(event) => setTilt(Number(event.target.value))} />
                </label>
              </figure>
            ) : null}
          </div>
          <p className="hint">
            {ru
              ? 'Листайте колесом или стрелками, как стопку МРТ. Аксиальный срез и кадр кино — одна позиция хода. Щелчок ставит перекрестье. Серый — эхо прохода, пустая ячейка не наблюдалась. Это не миллиметры пациента.'
              : 'Scroll with the wheel or arrows, as with an MRI stack. The axial slice and the cine frame are the same point on the path. A click places the crosshair. Gray is echo from the pass, an empty cell was not observed. These are not patient millimetres.'}
          </p>
          {volume ? <VtkReslice volume={volume} index={axes.z} /> : null}
          </>
          ) : null}
          {view === 'volume' && volume ? <div id="spatial-vtk"><VtkVolume volume={volume} /></div> : null}
          {view === 'pathology' && study ? <StudyReadout study={study} focusId={focusId} ru={ru} onPlace={placeCandidate} section="pathology" /> : null}
          {view === 'report' && study ? <StudyReadout study={study} focusId={focusId} ru={ru} onPlace={placeCandidate} section="report" /> : null}
          {view === 'fusion' ? (
            <div className="study-readout">
              <h3>{ru ? 'Слияние' : 'Fusion'}</h3>
              <p>{fusionLine(series, shift, ru)}</p>
              <label className="ghost file-pick">
                {ru ? 'Файлы DICOM' : 'DICOM files'}
                <input
                  type="file"
                  accept=".dcm,application/dicom"
                  multiple
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])]
                    event.target.value = ''
                    if (files.length > 0) void loadCross(files)
                  }}
                />
              </label>
              {crossNote ? <p className="banner bad">{crossNote}</p> : null}
              {series && crossMode !== 'hidden' ? (
                <div className="freehand-slices">
                  {crossMode === 'beside' && slices[0] ? (
                    <figure>
                      <SliceCanvas
                        slice={slices[0]}
                        marker={draftUs ? { col: draftUs.u * slices[0].width, row: draftUs.v * slices[0].height } : null}
                        onPick={(col, row) => setDraftUs({ u: col / slices[0].width, v: row / slices[0].height })}
                      />
                      <figcaption>{ru ? 'УЗИ, RECONSTRUCTED. Точка — ориентир.' : 'Ultrasound, RECONSTRUCTED. The point is a landmark.'}</figcaption>
                    </figure>
                  ) : null}
                  <figure>
                    <GrayThumb
                      gray={series.frames[crossIndex] ?? series.frames[0] ?? new Float32Array()}
                      width={series.width}
                      height={series.height}
                      marker={pairs[pairs.length - 1]?.other ?? null}
                      onPick={draftUs && pairs.length < 2 ? (point) => {
                        setPairs((current) => [...current, { ultrasound: draftUs, other: point }])
                        setDraftUs(null)
                      } : undefined}
                    />
                    <figcaption>
                      {series.modality}. {crossIndex + 1}/{series.frames.length}.
                      {' '}{series.sliceStepMm == null
                        ? (ru ? 'Шаг между кадрами не задан.' : 'The step between frames is not recorded.')
                        : (ru ? `Шаг в файле ${series.sliceStepMm} мм, на объём УЗИ не перенесён.` : `File step ${series.sliceStepMm} mm, not applied to the ultrasound volume.`)}
                      {' '}{ru ? 'Яркость растянута для показа.' : 'Brightness is stretched for display.'}
                    </figcaption>
                    {series.frames.length > 1 ? (
                      <label className="row">
                        {ru ? 'Кадр серии' : 'Series frame'}
                        <input
                          type="range"
                          min={0}
                          max={series.frames.length - 1}
                          value={crossIndex}
                          onChange={(event) => setCrossIndex(Number(event.target.value))}
                        />
                      </label>
                    ) : null}
                  </figure>
                </div>
              ) : null}
              {shift && slices[0] && series ? (
                <figure className="spatial-volume">
                  <ShiftCanvas
                    slice={slices[0]}
                    gray={series.frames[crossIndex] ?? series.frames[0] ?? new Float32Array()}
                    width={series.width}
                    height={series.height}
                    matrix={shift.matrix}
                  />
                  <figcaption>
                    {ru
                      ? `Сдвиг по ${shift.pairs} ${shift.pairs === 1 ? 'паре' : 'парам'}. Уверенность ${shift.confidence.toFixed(2)}. Бирюзовый — серия, серый — УЗИ. Аффинное и деформируемое совмещение не запускались.`
                      : `Shift from ${shift.pairs} pair(s). Confidence ${shift.confidence.toFixed(2)}. Teal is the series, gray is ultrasound. Affine and deformable registration did not run.`}
                  </figcaption>
                </figure>
              ) : null}
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setView('mpr')}>{ru ? 'Показать УЗИ' : 'Show ultrasound'}</button>
                <button type="button" className="ghost" disabled={!series} onClick={() => setCrossMode('alone')}>{ru ? 'Показать MRI/CT' : 'Show MRI/CT'}</button>
                <button type="button" className="ghost" disabled={series?.modality !== 'MR' && series?.modality !== 'CT'} onClick={() => setCrossMode('beside')}>{ru ? 'Показать рядом' : 'Show beside'}</button>
                <button type="button" className="ghost" disabled={pairs.length === 0 && !draftUs} onClick={() => { setPairs([]); setDraftUs(null) }}>{ru ? 'Сбросить ориентиры' : 'Clear landmarks'}</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function SliceCanvas({ slice, crosshair, marker, onPick, onStep }: {
  slice: OrthogonalSlice
  crosshair?: { col: number; row: number } | null
  marker?: { col: number; row: number } | null
  onPick?: (col: number, row: number) => void
  onStep?: (delta: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const step = useRef(onStep)
  step.current = onStep
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = Math.max(1, slice.width)
    canvas.height = Math.max(1, slice.height)
    const context = canvas.getContext('2d')
    if (!context || slice.rgba.length !== canvas.width * canvas.height * 4) return
    context.putImageData(new ImageData(new Uint8ClampedArray(slice.rgba), canvas.width, canvas.height), 0, 0)
    if (crosshair) {
      context.strokeStyle = '#3ecfb0'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(0, crosshair.row + 0.5)
      context.lineTo(canvas.width, crosshair.row + 0.5)
      context.moveTo(crosshair.col + 0.5, 0)
      context.lineTo(crosshair.col + 0.5, canvas.height)
      context.stroke()
    }
    if (!marker) return
    context.strokeStyle = '#f0c14a'
    context.lineWidth = 1
    context.strokeRect(marker.col - 1.5, marker.row - 1.5, 3, 3)
  }, [slice, crosshair, marker])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !onStep) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      step.current?.(event.deltaY > 0 ? 1 : -1)
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => canvas.removeEventListener('wheel', wheel)
  }, [onStep])
  return (
    <canvas
      ref={ref}
      tabIndex={onStep ? 0 : undefined}
      aria-label={`${slice.axis} ${slice.index + 1}`}
      onClick={onPick ? (event) => {
        const canvas = ref.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return
        const col = ((event.clientX - rect.left) / rect.width) * canvas.width
        const row = ((event.clientY - rect.top) / rect.height) * canvas.height
        onPick(col, row)
      } : undefined}
      onKeyDown={onStep ? (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault()
          onStep(1)
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onStep(-1)
        }
      } : undefined}
    />
  )
}

function PictureCanvas({ picture }: { picture: VolumePicture }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = Math.max(1, picture.width)
    canvas.height = Math.max(1, picture.height)
    const context = canvas.getContext('2d')
    if (!context || picture.rgba.length !== canvas.width * canvas.height * 4) return
    context.putImageData(new ImageData(new Uint8ClampedArray(picture.rgba), canvas.width, canvas.height), 0, 0)
  }, [picture])
  return <canvas ref={ref} />
}

function StudyReadout({ study, focusId, ru, onPlace, section }: {
  study: UltrasoundStudy
  focusId: string | null
  ru: boolean
  onPlace: (item: LesionCandidate, target: 'slice' | 'cine' | 'volume') => void
  section: 'pathology' | 'report'
}) {
  return (
    <div className="study-readout">
      {section === 'report' ? study.report.examination.map((line) => <p key={line}>{line}</p>) : null}
      {section === 'report' ? <h3>{atlasTitle(study.organ)}, {ru ? 'атлас' : 'atlas'}</h3> : null}
      {section === 'report' ? study.anatomy.map((node) => <p key={node.name}>{node.name}: {ru ? 'не подтверждено на картине.' : 'not confirmed on the picture.'}</p>) : null}
      {section === 'pathology' ? <h3>{ru ? 'Кандидаты' : 'Candidates'}</h3> : null}
      {section === 'pathology' && study.tissue.length > 0 ? <p>{ru ? 'Ткань: только относительная яркость эхо.' : 'Tissue: relative echo brightness only.'}</p> : null}
      {section === 'pathology' && study.dataStatus === 'INSUFFICIENT DATA' ? <p>{ru ? 'Данных для очага мало.' : 'Too little data for a focus.'}</p> : null}
      {section === 'pathology' && study.candidates.length === 0 ? <p>{ru ? 'Кандидата по яркости нет. Это не значит, что патологии нет.' : 'No brightness candidate. That does not mean there is no pathology.'}</p> : null}
      {section === 'pathology' ? study.candidates.map((item) => (
        <article key={item.id} className={item.id === focusId ? 'candidate-card focus' : 'candidate-card'}>
          <p>{item.echogenicity}. {ru ? 'Кандидат, не диагноз.' : 'A candidate, not a diagnosis.'}</p>
          <p>
            {ru ? 'Сетка' : 'Grid'} {item.location.x.toFixed(1)}, {item.location.y.toFixed(1)}, {item.location.z.toFixed(1)}.
            {' '}{ru ? 'Размер' : 'Size'} {item.extent.x}×{item.extent.y}×{item.extent.z} {ru ? 'ячеек' : 'cells'}, {item.voxelCount} {ru ? 'вокселей' : 'voxels'}.
          </p>
          <p>
            {ru ? 'Кадры' : 'Frames'} {item.provenance.frames.join(', ') || (ru ? 'не сопоставлены' : 'not matched')}.
            {' '}{ru ? 'Время' : 'Time'} {item.provenance.timestamp}.
            {' '}{ru ? 'Согласованность' : 'Consistency'} {item.provenance.spatialConsistency.toFixed(2)} / {item.provenance.temporalConsistency.toFixed(2)}.
            {' '}{ru ? 'По глубине сетки' : 'Along the grid'} {item.extent.z}. {ru
              ? `На ${item.hold.sameSign} из ${item.hold.matched} сопоставленных кадров знак яркости тот же. Это не трекинг.`
              : `The same brightness sign holds on ${item.hold.sameSign} of ${item.hold.matched} matched frames. This is not tracking.`}
            {' '}{ru ? 'Уверенность' : 'Confidence'} {item.provenance.confidence.overall.toFixed(2)}
            {' '}(visual {item.provenance.confidence.visual.toFixed(2)}, spatial {item.provenance.confidence.spatial.toFixed(2)}, temporal {item.provenance.confidence.temporal.toFixed(2)}).
          </p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => onPlace(item, 'slice')}>{ru ? 'Показать в срезе' : 'Show in slice'}</button>
            <button type="button" className="ghost" onClick={() => onPlace(item, 'cine')}>{ru ? 'Показать в кино' : 'Show in cine'}</button>
            <button type="button" className="ghost" onClick={() => onPlace(item, 'volume')}>{ru ? 'Показать в объёме' : 'Show in volume'}</button>
          </div>
        </article>
      )) : null}
      {section === 'report' ? <h3>{ru ? 'Находки' : 'Findings'}</h3> : null}
      {section === 'report' ? study.report.findings.map((line, index) => <p key={`finding-${index}`}>{line}</p>) : null}
      {section === 'report' ? <h3>{ru ? 'Ограничения' : 'Limitations'}</h3> : null}
      {section === 'report' ? study.report.limitations.map((line, index) => <p key={`limit-${index}`}>{line}</p>) : null}
      {section === 'report' ? <h3>{ru ? 'Черновик' : 'Draft'}</h3> : null}
      {section === 'report' ? <p>{study.report.conclusion}</p> : null}
    </div>
  )
}

function CineStrip({ study, preview, focus, ru, budget, important, onToggle }: {
  study: UltrasoundStudy
  preview: SpatialPreview
  focus: LesionCandidate | null
  ru: boolean
  budget: AIFrameBudget | null
  important: readonly string[]
  index: number
  linked: string
  onIndex: (index: number) => void
  onToggle: (id: string) => void
}) {
  const focusFrame = focus?.provenance.frames[0]
  const jumped = useRef('')
  useEffect(() => {
    if (!focusFrame || jumped.current === focusFrame) return
    jumped.current = focusFrame
    const found = preview.slices.findIndex((item) => item.id === focusFrame)
    if (found >= 0) onIndex(found)
  }, [focusFrame, preview, onIndex])
  const first = study.frames[0]
  const last = study.frames[study.frames.length - 1]
  const span = first && last ? Math.max(0, last.timestamp - first.timestamp) : 0
  const fps = span > 0 ? ((study.frames.length - 1) * 1000) / span : 0
  const marked = new Set(focus?.provenance.frames ?? [])
  const at = preview.slices.length === 0 ? 0 : Math.min(index, preview.slices.length - 1)
  const current = preview.slices[at]
  const meta = study.frames.find((frame) => frame.id === current?.id)
  const key = study.keyFrames.find((frame) => frame.frameId === current?.id)
  const motion = current ? Math.max(0, 1 - current.similarity) : 0
  return (
    <div id="spatial-cine" className="study-readout">
      <h3>{ru ? 'Кино' : 'Cine'}</h3>
      <p>
        {study.frames.length} {ru ? 'срезов' : 'slices'}
        {span > 0 ? `, ${(span / 1000).toFixed(1)} ${ru ? 'с' : 's'}, ${fps.toFixed(1)} FPS` : ''}.
        {' '}{ru ? 'Ключевые' : 'Key'} {study.keyFrames.length}.
        {' '}{ru
          ? `Смена картинки средняя ${study.temporal.meanChange.toFixed(2)}, пик ${study.temporal.peakChange.toFixed(2)}.`
          : `Picture change averages ${study.temporal.meanChange.toFixed(2)}, peak ${study.temporal.peakChange.toFixed(2)}.`}
        {budget ? ` ${ru ? 'Для модели отобрано' : 'Set aside for a model'}: ${budget.priority.length}.` : ''}
        {study.resampled ? ` ${ru ? 'Вокруг кандидата выборка плотнее.' : 'Sampling is denser around the candidate.'}` : ''}
        {important.length > 0 ? ` ${ru ? 'Важный отрезок' : 'Important span'}: ${important.length}.` : ''}
      </p>
      {current ? (
        <figure className="cine-now">
          <GrayThumb gray={current.gray} width={current.width} height={current.height} />
          <figcaption>
            {ru ? 'Кадр' : 'Frame'} {at + 1}/{preview.slices.length}. {ru ? 'Время' : 'Time'} {current.timestamp}.
            {' '}{ru ? 'Качество' : 'Quality'} {(meta?.quality.overall ?? current.quality).toFixed(2)}.
            {' '}{ru ? 'Смена к предыдущему' : 'Change from the previous'} {motion.toFixed(2)}.
            {' '}{ru ? 'Ход датчика' : 'Probe path'} {(current.probeX ?? 0).toFixed(1)}, {(current.probeY ?? 0).toFixed(1)}, {ru ? 'глубина' : 'depth'} {current.depth.toFixed(1)}.
            {linked ? ` ${linked}.` : ''}
            {' '}{key ? `${ru ? 'Ключевой' : 'Key'}: ${kindLabel(key.kind, ru)}.` : (ru ? 'Не ключевой.' : 'Not a key frame.')}
          </figcaption>
          {preview.slices.length > 1 ? (
            <label className="row">
              {ru ? 'Лента' : 'Timeline'}
              <input
                type="range"
                min={0}
                max={preview.slices.length - 1}
                value={at}
                aria-label={ru ? 'Кадр петли' : 'Loop frame'}
                onChange={(event) => onIndex(Number(event.target.value))}
              />
            </label>
          ) : null}
        </figure>
      ) : null}
      <ProbePath slices={preview.slices} ru={ru} />
      <div className="cine-strip">
        {study.keyFrames.map((frame) => {
          const slice = preview.slices.find((item) => item.id === frame.frameId)
          const picked = important.includes(frame.frameId)
          return (
            <button
              key={`${frame.frameId}-${frame.kind}`}
              type="button"
              className={[marked.has(frame.frameId) ? 'marked' : '', picked ? 'important' : '', frame.frameId === current?.id ? 'current' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                const found = preview.slices.findIndex((item) => item.id === frame.frameId)
                if (found >= 0) onIndex(found)
                onToggle(frame.frameId)
              }}
            >
              {slice ? <GrayThumb gray={slice.gray} width={slice.width} height={slice.height} /> : null}
              <span>{kindLabel(frame.kind, ru)}{picked ? (ru ? ', важный' : ', important') : ''} · {frame.timestamp}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GrayThumb({ gray, width, height, marker, onPick }: {
  gray: Float32Array
  width: number
  height: number
  marker?: NormPoint | null
  onPick?: (point: NormPoint) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = Math.max(1, width)
    canvas.height = Math.max(1, height)
    const context = canvas.getContext('2d')
    if (!context || gray.length !== canvas.width * canvas.height) return
    const rgba = new Uint8ClampedArray(canvas.width * canvas.height * 4)
    for (let index = 0; index < gray.length; index += 1) {
      const tone = Math.round(Math.max(0, Math.min(1, gray[index] ?? 0)) * 255)
      rgba[index * 4] = tone
      rgba[index * 4 + 1] = tone
      rgba[index * 4 + 2] = tone
      rgba[index * 4 + 3] = 255
    }
    context.putImageData(new ImageData(rgba, canvas.width, canvas.height), 0, 0)
    if (!marker) return
    context.strokeStyle = '#f0c14a'
    context.strokeRect(marker.u * canvas.width - 1.5, marker.v * canvas.height - 1.5, 3, 3)
  }, [gray, width, height, marker])
  return (
    <canvas
      ref={ref}
      onClick={onPick ? (event) => {
        const canvas = ref.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return
        onPick({
          u: (event.clientX - rect.left) / rect.width,
          v: (event.clientY - rect.top) / rect.height,
        })
      } : undefined}
    />
  )
}

function ShiftCanvas({ slice, gray, width, height, matrix }: {
  slice: OrthogonalSlice
  gray: Float32Array
  width: number
  height: number
  matrix: readonly number[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = Math.max(1, slice.width)
    canvas.height = Math.max(1, slice.height)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = '#000'
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (slice.rgba.length === canvas.width * canvas.height * 4) {
      context.putImageData(new ImageData(new Uint8ClampedArray(slice.rgba), canvas.width, canvas.height), 0, 0)
    }
    const other = document.createElement('canvas')
    other.width = Math.max(1, width)
    other.height = Math.max(1, height)
    const otherContext = other.getContext('2d')
    if (!otherContext || gray.length !== other.width * other.height) return
    const rgba = new Uint8ClampedArray(other.width * other.height * 4)
    for (let index = 0; index < gray.length; index += 1) {
      const tone = Math.round(Math.max(0, Math.min(1, gray[index] ?? 0)) * 255)
      rgba[index * 4] = Math.round(tone * 0.25)
      rgba[index * 4 + 1] = Math.round(tone * 0.85)
      rgba[index * 4 + 2] = tone
      rgba[index * 4 + 3] = 190
    }
    otherContext.putImageData(new ImageData(rgba, other.width, other.height), 0, 0)
    context.setTransform(matrix[0] ?? 1, matrix[4] ?? 0, matrix[1] ?? 0, matrix[5] ?? 1, matrix[3] ?? 0, matrix[7] ?? 0)
    context.drawImage(other, 0, 0, canvas.width, canvas.height)
  }, [slice, gray, width, height, matrix])
  return <canvas ref={ref} />
}

function fusionLine(series: CrossSeries | null, shift: { pairs: number; confidence: number } | null, ru: boolean): string {
  if (!series) return ru ? 'MRI или CT не загружены. Слияние не выполняется.' : 'MRI or CT is not loaded. Fusion is not performed.'
  if (shift) {
    return ru
      ? `Серия ${series.frames.length}. Сдвиг по ${shift.pairs} ${shift.pairs === 1 ? 'паре' : 'парам'}, уверенность ${shift.confidence.toFixed(2)}. Это не миллиметры пациента.`
      : `Series of ${series.frames.length}. Shift from ${shift.pairs} pair(s), confidence ${shift.confidence.toFixed(2)}. This is not patient millimetres.`
  }
  return ru
    ? `Серия ${series.frames.length}. Совмещение не запускалось: нет общих ориентиров. Сначала точка на УЗИ, затем на серии.`
    : `Series of ${series.frames.length}. Registration did not run: there are no shared landmarks. First a point on the ultrasound, then on the series.`
}

function clampIndex(value: number, size: number): number {
  if (size <= 0) return 0
  return Math.max(0, Math.min(size - 1, Math.round(value)))
}

function probeLine(travel: { lateral: number; depth: number }, ru: boolean): string {
  return ru
    ? `Ход датчика по картинке: в плоскости до ${travel.lateral.toFixed(1)}, по глубине до ${travel.depth.toFixed(1)}. Единицы сетки, не датчик положения.`
    : `Probe path from the picture: up to ${travel.lateral.toFixed(1)} in plane, ${travel.depth.toFixed(1)} in depth. Grid units, not a position sensor.`
}

function ProbePath({ slices, ru }: { slices: readonly { probeX: number; probeY: number; depth: number }[]; ru: boolean }) {
  if (slices.length < 2) return null
  const width = 280
  const height = 120
  const pad = 12
  const xs = slices.map((slice) => slice.probeX)
  const zs = slices.map((slice) => slice.depth)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const spanX = Math.max(1, maxX - minX)
  const spanZ = Math.max(0.45, maxZ - minZ)
  const points = slices.map((slice) => {
    const x = pad + ((slice.probeX - minX) / spanX) * (width - pad * 2)
    const y = height - pad - ((slice.depth - minZ) / spanZ) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <figure>
      <svg className="trajectory-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ru ? 'Ход датчика' : 'Probe path'}>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <figcaption>{ru ? 'Плоскость слева направо, глубина снизу вверх.' : 'In-plane motion left to right, depth upward.'}</figcaption>
    </figure>
  )
}

function kindLabel(kind: string, ru: boolean): string {
  if (kind === 'BOUNDARY') return ru ? 'край' : 'edge'
  if (kind === 'BEST_QUALITY') return ru ? 'резкость' : 'sharp'
  if (kind === 'MOTION') return ru ? 'смена' : 'change'
  if (kind === 'PATHOLOGY_SUSPECT') return ru ? 'кандидат' : 'candidate'
  return ru ? 'кадр' : 'frame'
}
