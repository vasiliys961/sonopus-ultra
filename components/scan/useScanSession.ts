'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CalibrationState, DiagnosticResult, QualityScore, Raster, ScanMode, SourceType, UltrasoundFrame } from '@/lib/domain/types'
import { hasMeasurementScale } from '@/lib/domain/types'
import { createScreenAdapter, createUvcAdapter, listVideoInputs, paintRaster } from '@/lib/device-hub/browser-media'
import { createSyntheticAdapter } from '@/lib/device-hub/synthetic-adapter'
import type { SyntheticScene } from '@/lib/device-hub/synthetic-frame'
import type { UltrasoundStreamAdapter } from '@/lib/device-hub/types'
import { SOURCE_TRUST } from '@/lib/device-hub/types'
import { applyOperatorDecision, editProposedLabel, readyToForward } from '@/lib/diagnostic-arbiter/review'
import { bytesToBase64 } from '@/lib/image/base64'
import { estimateAnechoicDiameterPx } from '@/lib/ultrasound-modules/ivc/measurement'
import { draftToManual, emptyDraft, type MeasurementDraft } from '@/lib/ultrasound-modules/manual-draft'
import { getOrganModule, listOrganModules } from '@/lib/ultrasound-modules/registry'
import { guidanceReady, guidanceWaitMs } from '@/lib/guidance/read-pace'
import { QualityStreakTracker, scoreRaster, technicalHint } from '@/lib/quality-gate'
import { panelFromPerception, type VisionPanel } from '@/lib/vision-engine/guidance'
import { rasterToGray } from '@/lib/quality/gray'
import { SessionQualityLog } from '@/lib/training-log/session-log'
import { TrainingFrameLog } from '@/lib/training-log/frame-log'
import { useLocale } from '@/components/LocaleProvider'
import { cabinetLocale, LOCALES, moduleCopy } from '@/lib/i18n/copy'
import { speechTag } from '@/lib/i18n/locales'
import { chooseSeries } from '@/lib/ultra/choose-series'
import { jpegToRaster, rasterToJpeg } from '@/lib/ultra/frame-jpeg'
import { PASS_INTERVAL_MS, trimPass } from '@/lib/ultra/pass-loop'

export interface CaptureShot {
  evidenceId: string
  view: string
  raster: Raster
  qualityScore: number
  timestamp: number
  sequenceNumber: number
}

interface LatestFrame {
  raster: Raster
  score: QualityScore
  timestamp: number
  sequenceNumber: number
}

export interface PassShot {
  jpeg: string
  width: number
  height: number
  qualityScore: number
  timestamp: number
  sequenceNumber: number
  pinned: boolean
}

function copyRaster(raster: Raster): Raster {
  return { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) }
}

export function useScanSession() {
  const { locale } = useLocale()
  const params = useSearchParams()
  const mode: ScanMode = params.get('mode') === 'second-opinion' ? 'second-opinion' : 'guided'
  const modeRef = useRef(mode)
  const [stepShownAt, setStepShownAt] = useState(() => Date.now())
  const [clock, setClock] = useState(() => Date.now())
  const stepShownAtRef = useRef(stepShownAt)
  const stepKeyRef = useRef('')
  const modules = useMemo(() => listOrganModules(), [])
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? 'bladder')
  const module = getOrganModule(moduleId) ?? modules[0]
  const [source, setSource] = useState<SourceType>('synthetic')
  const [deviceId, setDeviceId] = useState('')
  const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [score, setScore] = useState<QualityScore | null>(null)
  const [heldMs, setHeldMs] = useState(0)
  const [captures, setCaptures] = useState<Record<string, CaptureShot>>({})
  const [draft, setDraft] = useState<MeasurementDraft>(emptyDraft)
  const [contourKey, setContourKey] = useState<keyof MeasurementDraft['contours']>('a4cDiastole')
  const [question, setQuestion] = useState(module?.defaultQuestion ?? '')
  const [note, setNote] = useState('')
  const [regionName, setRegionName] = useState(module?.title ?? '')
  const [regionConfirmed, setRegionConfirmed] = useState(false)
  const [calipersAttested, setCalipersAttested] = useState(false)
  const [pixelSpacing, setPixelSpacing] = useState<number | null>(null)
  const [diameters, setDiameters] = useState<number[]>([])
  const [scene, setScene] = useState<SyntheticScene>({ blurPasses: 0, gain: 1, motionShift: 0, phase: 0 })
  const [consent, setConsent] = useState(false)
  const [frameConsent, setFrameConsent] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const [forwardState, setForwardState] = useState('')
  const [listening, setListening] = useState(false)
  const [visionOn, setVisionOn] = useState(false)
  const [visionPanel, setVisionPanel] = useState<VisionPanel | null>(null)
  const visionOnRef = useRef(false)
  const visionSessionRef = useRef<string | null>(null)
  const lastVisionPostRef = useRef(0)
  const visionTicketRef = useRef(0)
  const passOnRef = useRef(false)
  const passRef = useRef<PassShot[]>([])
  const [passOn, setPassOn] = useState(false)
  const [passFrames, setPassFrames] = useState<PassShot[]>([])
  const [chosenFrames, setChosenFrames] = useState<PassShot[]>([])
  const [pinnedCount, setPinnedCount] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const sampleRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const adapterRef = useRef<UltrasoundStreamAdapter | null>(null)
  const latestRef = useRef<LatestFrame | null>(null)
  const prevRasterRef = useRef<Raster | null>(null)
  const streakRef = useRef(new QualityStreakTracker())
  const capturesRef = useRef(captures)
  const moduleRef = useRef(module)
  const sceneRef = useRef(scene)
  const sourceRef = useRef(source)
  const consentRef = useRef(consent)
  const diametersRef = useRef<number[]>([])
  const logRef = useRef(new SessionQualityLog())
  const frameLogRef = useRef(new TrainingFrameLog())
  const frameConsentRef = useRef(frameConsent)
  const voiceRef = useRef<{ stop: () => void } | null>(null)
  const studyIdRef = useRef(crypto.randomUUID())

  capturesRef.current = captures
  moduleRef.current = module
  sceneRef.current = scene
  sourceRef.current = source
  modeRef.current = mode
  stepShownAtRef.current = stepShownAt
  consentRef.current = consent
  frameConsentRef.current = frameConsent

  useEffect(() => {
    void listVideoInputs().then(setDevices).catch(() => setDevices([]))
    return () => adapterRef.current?.disconnect()
  }, [])

  useEffect(() => {
    if (!module) return
    setQuestion(module.defaultQuestion)
    setRegionName(module.title)
    setRegionConfirmed(false)
    setCalipersAttested(false)
    setDraft(emptyDraft())
    studyIdRef.current = crypto.randomUUID()
    setCaptures({})
    capturesRef.current = {}
    setResult(null)
    setDiameters([])
    diametersRef.current = []
    streakRef.current.reset()
    stepKeyRef.current = ''
    visionSessionRef.current = null
    lastVisionPostRef.current = 0
    setVisionPanel(null)
    const shown = Date.now()
    stepShownAtRef.current = shown
    setStepShownAt(shown)
  }, [moduleId, module])

  useEffect(() => {
    if (!module) return
    const pack = moduleCopy[cabinetLocale(locale)][module.id]
    if (!pack) return
    const questions = [module.defaultQuestion, ...LOCALES.map((code) => moduleCopy[code][module.id]?.question ?? '')]
    const titles = [module.title, ...LOCALES.map((code) => moduleCopy[code][module.id]?.title ?? '')]
    setQuestion((prev) => (questions.includes(prev) ? pack.question : prev))
    setRegionName((prev) => (titles.includes(prev) ? pack.title : prev))
  }, [locale, moduleId, module])

  const currentView = module?.requiredViews.find((view) => !captures[view]) ?? null
  useEffect(() => {
    if (mode !== 'guided' || !currentView) return
    const timer = setInterval(() => setClock(Date.now()), 500)
    return () => clearInterval(timer)
  }, [mode, currentView, moduleId])
  const readWaitMs = currentView ? guidanceWaitMs(mode, stepShownAt, clock) : 0
  const manual = module ? draftToManual(module.id, draft) : undefined
  const calibration: CalibrationState = pixelSpacing
    ? { status: 'verified', mmPerPixel: pixelSpacing, source: 'dicom-pixel-spacing' }
    : calipersAttested
      ? { status: 'verified', source: 'device-calipers', attestedByOperator: true }
      : { status: 'unavailable', reason: 'шкала не подтверждена' }
  const typedNeedsAttestation = manual?.kind === 'bladder' || manual?.kind === 'thyroid' || manual?.kind === 'ivc' || (manual?.kind === 'cardiac-ef' && (manual.edvMl !== undefined || manual.esvMl !== undefined))
  const measurementCalibration: CalibrationState = typedNeedsAttestation && !calipersAttested
    ? { status: 'unavailable', reason: 'числа в мм или мл не подтверждены калиперами аппарата' }
    : calibration
  const preview = module
    ? module.computeMeasurement({
        frames: [],
        calibration: measurementCalibration,
        manual,
        diameterSeriesPx: diameters,
      })
    : null

  function remember(view: string) {
    const latest = latestRef.current
    const current = moduleRef.current
    if (!latest || !current || capturesRef.current[view]) return
    const shot: CaptureShot = {
      evidenceId: `${view}-${crypto.randomUUID()}`,
      view,
      raster: copyRaster(latest.raster),
      qualityScore: latest.score.qualityScore,
      timestamp: latest.timestamp,
      sequenceNumber: latest.sequenceNumber,
    }
    const next = { ...capturesRef.current, [view]: shot }
    capturesRef.current = next
    setCaptures(next)
    streakRef.current.reset()
    setHeldMs(0)
  }

  function onFrame(frame: UltrasoundFrame) {
    const raster = copyRaster(frame.imageData)
    const nextScore = scoreRaster(raster, prevRasterRef.current)
    prevRasterRef.current = raster
    latestRef.current = {
      raster,
      score: nextScore,
      timestamp: frame.timestamp,
      sequenceNumber: frame.sequenceNumber,
    }
    if (passOnRef.current) {
      const last = passRef.current[passRef.current.length - 1]
      if (!last || frame.timestamp - last.timestamp >= PASS_INTERVAL_MS) {
        const jpeg = rasterToJpeg(raster)
        if (jpeg) {
          const shot: PassShot = {
            jpeg,
            width: raster.width,
            height: raster.height,
            qualityScore: nextScore.qualityScore,
            timestamp: frame.timestamp,
            sequenceNumber: frame.sequenceNumber,
            pinned: false,
          }
          const next = trimPass([...passRef.current, shot])
          passRef.current = next
          setPassFrames(next)
        }
      }
    }
    const streak = streakRef.current.push(nextScore.qualityScore, frame.timestamp)
    setScore(nextScore)
    setHeldMs(streak.heldMs)
    const previewCanvas = previewRef.current
    if (previewCanvas && sourceRef.current === 'synthetic') paintRaster(previewCanvas, raster)
    const current = moduleRef.current
    if (current) {
      logRef.current.add(
        { organModule: current.id, qualityScore: nextScore.qualityScore, timestamp: frame.timestamp },
        consentRef.current,
      )
      if (frameConsentRef.current && frame.sequenceNumber % 10 === 0) {
        frameLogRef.current.add(
          {
            organModule: current.id,
            qualityScore: nextScore.qualityScore,
            timestamp: frame.timestamp,
            raster,
          },
          true,
        )
        setFrameCount(frameLogRef.current.count())
      }
      if (current.id === 'ivc' && nextScore.qualityScore >= current.qualityThreshold && frame.sequenceNumber % 5 === 0) {
        const gray = rasterToGray(raster)
        const diameter = estimateAnechoicDiameterPx(gray, raster.width, raster.height, Math.floor(raster.height * 0.55))
        if (diameter) {
          const series = [...diametersRef.current, diameter].slice(-40)
          diametersRef.current = series
          setDiameters(series)
        }
      }
      const view = current.requiredViews.find((name) => !capturesRef.current[name])
      const stepKey = `${current.id}:${view ?? 'done'}`
      if (stepKeyRef.current !== stepKey) {
        stepKeyRef.current = stepKey
        stepShownAtRef.current = frame.timestamp
        setStepShownAt(frame.timestamp)
      }
      const paced = guidanceReady(modeRef.current, stepShownAtRef.current, frame.timestamp)
      if (view && paced && streak.ready && nextScore.qualityScore >= current.qualityThreshold) remember(view)
      const pending = current.requiredViews.find((name) => !capturesRef.current[name]) ?? null
      noteVision({ imageData: raster, timestamp: frame.timestamp, sequenceNumber: frame.sequenceNumber }, nextScore, streak.ready, pending)
    }
  }

  function noteVision(frame: UltrasoundFrame, nextScore: QualityScore, streakReady: boolean, view: string | null) {
    if (!visionOnRef.current) return
    const current = moduleRef.current
    if (!current) return
    const motion = 1 - nextScore.stability
    const tracking = streakReady ? 'stable' : nextScore.qualityScore >= current.qualityThreshold ? 'tracking' : 'unstable'
    setVisionPanel((prev) => {
      const local = panelFromPerception({
        quality: nextScore.qualityScore,
        motion,
        tracking,
        pack: null,
        protocolDone: current.requiredViews.filter((name) => capturesRef.current[name]).length,
        protocolTotal: current.requiredViews.length,
        missingView: view,
        cloudNote: prev?.uncertainty ?? null,
      })
      return {
        ...local,
        anatomy: prev?.anatomy ?? null,
        plane: prev?.plane ?? null,
        confidence: prev?.confidence ?? null,
        frames: prev?.frames ?? 0,
        clips: prev?.clips ?? 0,
        observations: prev?.observations ?? 0,
        candidates: prev?.candidates ?? 0,
      }
    })
    if (!streakReady || nextScore.qualityScore < current.qualityThreshold) return
    if (frame.timestamp - lastVisionPostRef.current < 2000) return
    lastVisionPostRef.current = frame.timestamp
    const ticket = ++visionTicketRef.current
    void sendVisionFrame(frame, ticket)
  }

  async function sendVisionFrame(frame: UltrasoundFrame, ticket: number) {
    const current = moduleRef.current
    if (!current || !visionOnRef.current) return
    try {
      let sessionId = visionSessionRef.current
      if (!sessionId) {
        const opened = await fetch('/vision/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ studyId: studyIdRef.current, moduleId: current.id }),
        })
        const created = (await opened.json()) as { id?: string; error?: string }
        if (!opened.ok || !created.id) throw new Error(created.error ?? 'сессия зрения не открылась')
        sessionId = created.id
        visionSessionRef.current = sessionId
      }
      const response = await fetch('/vision/frame', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sequenceNumber: frame.sequenceNumber,
          timestamp: frame.timestamp,
          width: frame.imageData.width,
          height: frame.imageData.height,
          rgbaBase64: bytesToBase64(frame.imageData.data),
          confirmedViews: Object.keys(capturesRef.current),
        }),
      })
      const payload = (await response.json()) as { panel?: VisionPanel; error?: string }
      if (!response.ok || !payload.panel) throw new Error(payload.error ?? 'кадр зрения не принят')
      if (visionOnRef.current && ticket === visionTicketRef.current) setVisionPanel(payload.panel)
    } catch (cause) {
      if (!visionOnRef.current) return
      const message = cause instanceof Error ? cause.message : 'слой зрения недоступен'
      setVisionPanel((prev) => (prev ? { ...prev, uncertainty: message } : prev))
    }
  }

  function setVisionEnabled(enabled: boolean) {
    visionOnRef.current = enabled
    setVisionOn(enabled)
    if (!enabled) {
      visionSessionRef.current = null
      lastVisionPostRef.current = 0
      setVisionPanel(null)
    }
  }

  async function start() {
    const video = videoRef.current
    const sample = sampleRef.current
    if (!video || !sample) return
    adapterRef.current?.disconnect()
    prevRasterRef.current = null
    streakRef.current.reset()
    setError('')
    try {
      const adapter =
        source === 'synthetic'
          ? createSyntheticAdapter({ getScene: () => sceneRef.current })
          : source === 'screen-capture'
            ? createScreenAdapter(video, sample)
            : createUvcAdapter(video, sample)
      adapterRef.current = adapter
      adapter.onFrame(onFrame)
      await adapter.connect(deviceId || undefined)
      setRunning(true)
    } catch (cause) {
      setRunning(false)
      setError(cause instanceof Error ? cause.message : 'Не удалось открыть источник')
    }
  }

  function stop() {
    adapterRef.current?.disconnect()
    adapterRef.current = null
    setRunning(false)
  }

  async function inspectDicom(file: File) {
    const response = await fetch('/api/sono/dicom-inspect', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: await file.arrayBuffer(),
    })
    const payload = (await response.json()) as { mmPerPixel: number | null; reason?: string }
    if (!response.ok || !payload.mmPerPixel) {
      setPixelSpacing(null)
      setError(payload.reason ?? 'Калибровку из DICOM прочитать не удалось')
      return
    }
    setPixelSpacing(payload.mmPerPixel)
    setError('')
  }

  async function inspectDicomFolder() {
    const response = await fetch('/api/sono/dicom-folder')
    const payload = (await response.json()) as { mmPerPixel: number | null; reason?: string }
    if (!response.ok || !payload.mmPerPixel) {
      setPixelSpacing(null)
      setError(payload.reason ?? 'папку DICOM прочитать не удалось')
      return
    }
    setPixelSpacing(payload.mmPerPixel)
    setError('')
  }

  function downloadFrameLog() {
    const frames = frameLogRef.current.snapshot().map((frame) => ({
      organModule: frame.organModule,
      qualityScore: frame.qualityScore,
      timestamp: frame.timestamp,
      width: frame.raster.width,
      height: frame.raster.height,
      rgbaBase64: bytesToBase64(frame.raster.data),
    }))
    const blob = new Blob([JSON.stringify({ frames }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sono-frame-log.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function toggleVoice() {
    if (listening) {
      voiceRef.current?.stop()
      voiceRef.current = null
      setListening(false)
      return
    }
    const host = window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    const Ctor = host.webkitSpeechRecognition
    if (!Ctor) {
      setError('Голосовой ввод в этом браузере недоступен. Комментарий можно набрать текстом.')
      return
    }
    const rec = new Ctor()
    rec.lang = speechTag(locale)
    rec.continuous = true
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1]?.[0]?.transcript
      if (last) setNote((prev) => (prev ? `${prev} ${last}` : last))
    }
    rec.start()
    voiceRef.current = { stop: () => rec.stop() }
    setListening(true)
  }

  function setPassRecording(on: boolean) {
    passOnRef.current = on
    setPassOn(on)
    if (on) {
      passRef.current = []
      setPassFrames([])
      setChosenFrames([])
      setPinnedCount(0)
    }
  }

  function pinLatestFrame(): boolean {
    const frames = passRef.current
    const last = frames[frames.length - 1]
    if (!last || last.pinned) return false
    const next = frames.map((shot, index) => (index === frames.length - 1 ? { ...shot, pinned: true } : shot))
    passRef.current = next
    setPassFrames(next)
    setPinnedCount(next.filter((shot) => shot.pinned).length)
    return true
  }

  async function diagnose(spoken?: string) {
    if (!module) return
    setDiagnosing(true)
    setForwardState('')
    try {
      const series = passRef.current.length
        ? await chooseSeries(passRef.current, regionName)
        : []
      setChosenFrames(series)
      const buckets = module.requiredViews.map(() => [] as string[])
      series.forEach((shot, shotIndex) => {
        buckets[Math.min(shotIndex, buckets.length - 1)].push(`pass-${shot.sequenceNumber}`)
      })
      const frames = series.length
        ? await Promise.all(series.map(async (shot) => {
            const raster = await jpegToRaster(shot.jpeg)
            return {
              evidenceId: `pass-${shot.sequenceNumber}`,
              timestamp: shot.timestamp,
              sequenceNumber: shot.sequenceNumber,
              width: raster.width,
              height: raster.height,
              rgbaBase64: bytesToBase64(raster.data),
              qualityScore: shot.qualityScore,
            }
          }))
        : Object.values(captures).map((shot) => ({
            evidenceId: shot.evidenceId,
            timestamp: shot.timestamp,
            sequenceNumber: shot.sequenceNumber,
            width: shot.raster.width,
            height: shot.raster.height,
            rgbaBase64: bytesToBase64(shot.raster.data),
            qualityScore: shot.qualityScore,
          }))
      const response = await fetch('/api/sono/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studyId: studyIdRef.current,
          moduleId: module.id,
          question,
          bodyRegion: { name: regionName, confirmedByOperator: regionConfirmed },
          views: module.requiredViews.map((view, index) => ({
            name: view,
            evidenceIds: series.length ? buckets[index] : (captures[view] ? [captures[view].evidenceId] : []),
            operatorConfirmed: series.length ? buckets[index].length > 0 : Boolean(captures[view]),
            qualityScore: series.length
              ? (series[Math.min(index, series.length - 1)]?.qualityScore ?? 0)
              : (captures[view]?.qualityScore ?? 0),
          })),
          calibration: measurementCalibration,
          manual,
          frames,
          diameterSeriesPx: diameters,
          sourceType: source,
          operatorNote: (spoken ?? note).slice(0, 12000),
          reportLanguage: locale,
          previousResult: result,
        }),
      })
      setResult((await response.json()) as DiagnosticResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Разбор не отправился')
    } finally {
      setDiagnosing(false)
    }
  }

  async function forward() {
    if (!result || !module || !preview) return
    const response = await fetch('/api/sono/forward-to-doctor-opus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        diagnosticResult: result,
        sourceType: source,
        findings: module.toFindingsPayload(preview),
        calibration: preview.calibration,
      }),
    })
    const payload = (await response.json()) as { forwarded?: boolean; reason?: string }
    if (!response.ok) {
      setForwardState(payload.reason ?? 'Передача отклонена')
      return
    }
    setForwardState(payload.forwarded ? 'Результат передан.' : 'Doctor Opus не подключён. Пакет собран и остаётся в Sono.')
  }

  const hint = score && module && score.qualityScore < module.qualityThreshold ? technicalHint(score) : ''
  const forwardGate = result ? readyToForward(result) : { ok: false as const, reason: '' }
  const canForward = Boolean(result && forwardGate.ok && source !== 'synthetic')

  return {
    mode,
    modules,
    module,
    moduleId,
    setModuleId,
    source,
    setSource,
    deviceId,
    setDeviceId,
    devices,
    running,
    error,
    score,
    heldMs,
    captures,
    currentView,
    readWaitMs,
    draft,
    setDraft,
    contourKey,
    setContourKey,
    question,
    setQuestion,
    note,
    setNote,
    regionName,
    setRegionName,
    regionConfirmed,
    setRegionConfirmed,
    calipersAttested,
    setCalipersAttested,
    pixelSpacing,
    diameters,
    scene,
    setScene,
    consent,
    setConsent,
    frameConsent,
    setFrameConsent,
    frameCount,
    inspectDicomFolder,
    downloadFrameLog,
    result,
    setResult,
    diagnosing,
    forwardState,
    listening,
    visionOn,
    visionPanel,
    setVisionEnabled,
    passOn,
    passFrames,
    chosenFrames,
    pinnedCount,
    setPassRecording,
    pinLatestFrame,
    videoRef,
    sampleRef,
    previewRef,
    preview,
    hint,
    trust: SOURCE_TRUST[source],
    canForward,
    scaleVerified: hasMeasurementScale(measurementCalibration),
    start,
    stop,
    remember,
    inspectDicom,
    toggleVoice,
    diagnose,
    forward,
    accept: (id: string) => result && setResult(applyOperatorDecision(result, id, 'operator_accepted')),
    reject: (id: string) => result && setResult(applyOperatorDecision(result, id, 'operator_rejected')),
    editLabel: (id: string, label: string) => result && setResult(editProposedLabel(result, id, label)),
  }
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
}
