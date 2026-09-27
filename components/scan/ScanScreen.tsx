'use client'

import Link from 'next/link'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { DiagnosticReview } from '@/components/scan/DiagnosticReview'
import { MeasurementFields } from '@/components/scan/MeasurementFields'
import { Sensorless3dPanel } from '@/components/scan/Sensorless3dPanel'
import { useScanSession } from '@/components/scan/useScanSession'
import { cabinetLocale, moduleCopy, type MessageKey } from '@/lib/i18n/copy'
import { ATLAS_LINKS } from '@/lib/references/atlas'

const TRACKING_KEY: Record<string, MessageKey> = {
  off: 'tracking_off',
  unstable: 'tracking_unstable',
  tracking: 'tracking_tracking',
  stable: 'tracking_stable',
  lost: 'tracking_lost',
}

const GUIDANCE_KEY: Record<string, MessageKey> = {
  idle: 'visionIdle',
  hold_steady: 'visionHold',
  high_motion: 'visionMotion',
  plane_unconfirmed: 'visionPlaneUnknown',
  plane_found: 'visionPlaneFound',
  turn_for_view: 'visionTurn',
  quality_ok: 'visionQualityOk',
}

const PLANE_KEY: Record<string, MessageKey> = {
  longitudinal: 'planeLongitudinal',
  transverse: 'planeTransverse',
  oblique: 'planeOblique',
  apical: 'planeApical',
  parasternal_long: 'planeParasternalLong',
  parasternal_short: 'planeParasternalShort',
  subcostal: 'planeSubcostal',
  suprasternal: 'planeSuprasternal',
}

const ORGAN_KEY: Record<string, MessageKey> = {
  thyroid: 'organThyroid',
  carotid: 'organCarotid',
  jugular: 'organJugular',
  lung: 'organLung',
  pleura: 'organPleura',
  heart: 'organHeart',
  ivc: 'organIvc',
  bladder: 'organBladder',
  kidney: 'organKidney',
  liver: 'organLiver',
  gallbladder: 'organGallbladder',
  aorta: 'organAorta',
}

function deviceLabel(label: string, unnamed: (n: string) => string): string {
  const match = label.match(/^(?:Видеовход|Video input) (\d+)$/)
  return match?.[1] ? unnamed(match[1]) : label
}

export function ScanScreen() {
  const session = useScanSession()
  const { locale, t, text, viewTitle } = useLocale()
  const module = session.module
  if (!module) return <p className="pad">{t('modulesMissing')}</p>
  const pack = moduleCopy[cabinetLocale(locale)][module.id]
  const atlas = ATLAS_LINKS[module.id]
  const step = session.currentView ? pack?.views[session.currentView] : undefined
  const previewUnit = session.preview?.unit === 'ml'
    ? t('unitMl')
    : session.preview?.unit === 'ratio'
      ? t('unitRatio')
      : session.preview?.unit === 'percent'
        ? t('unitPercent')
        : session.preview?.unit === 'count'
          ? t('unitCount')
          : session.preview?.unit ?? ''
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="brand">
            <Link href="/">DOCTOR OPUS <span>SONO</span></Link>
          </p>
          <p className="muted">{session.mode === 'guided' ? 'Guided' : 'Second opinion'} · {t('trust')}: {session.trust}</p>
        </div>
        <div className="top-tools">
          <LanguageSwitch />
          <p className="disclaimer">{t('scanDisclaimer')}</p>
        </div>
      </header>
      <Sensorless3dPanel captures={session.captures} />
      <section className="work">
        <div className="panel stage">
          <div className="row">
            <label>
              {t('module')}
              <select value={session.moduleId} onChange={(event) => session.setModuleId(event.target.value)}>
                {session.modules.map((item) => (
                  <option key={item.id} value={item.id}>{moduleCopy[cabinetLocale(locale)][item.id]?.title ?? item.title}</option>
                ))}
              </select>
            </label>
            <label>
              {t('source')}
              <select value={session.source} onChange={(event) => session.setSource(event.target.value as typeof session.source)}>
                <option value="synthetic">{t('sourceSynthetic')}</option>
                <option value="uvc">{t('sourceUvc')}</option>
                <option value="hdmi">{t('sourceHdmi')}</option>
                <option value="screen-capture">{t('sourceScreen')}</option>
              </select>
            </label>
            {session.source === 'uvc' || session.source === 'hdmi' ? (
              <label>
                {t('device')}
                <select value={session.deviceId} onChange={(event) => session.setDeviceId(event.target.value)}>
                  <option value="">{t('deviceFirst')}</option>
                  {session.devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {deviceLabel(device.label, (n) => t('deviceUnnamed', { n }))}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <video ref={session.videoRef} className={session.source === 'synthetic' ? 'hidden' : undefined} muted playsInline aria-label={t('liveSource')} />
          <canvas ref={session.previewRef} className={session.source === 'synthetic' ? undefined : 'hidden'} aria-label={t('syntheticFrame')} />
          <canvas ref={session.sampleRef} className="hidden" />
          {session.source === 'synthetic' ? (
            <div className="row">
              <label>
                {t('blur')}
                <input type="range" min={0} max={6} value={session.scene.blurPasses} onChange={(event) => session.setScene({ ...session.scene, blurPasses: Number(event.target.value) })} />
              </label>
              <label>
                {t('gain')}
                <input type="range" min={0.2} max={1.8} step={0.1} value={session.scene.gain} onChange={(event) => session.setScene({ ...session.scene, gain: Number(event.target.value) })} />
              </label>
              <label>
                {t('shift')}
                <input type="range" min={0} max={24} value={session.scene.motionShift} onChange={(event) => session.setScene({ ...session.scene, motionShift: Number(event.target.value) })} />
              </label>
            </div>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={session.visionOn} onChange={(event) => session.setVisionEnabled(event.target.checked)} />
            {t('visionToggle')}
          </label>
          {session.visionOn && session.visionPanel ? (
            <div className="banner">
              <p>{t('quality')} {session.visionPanel.quality === null ? '—' : session.visionPanel.quality.toFixed(2)} · {t('visionAnatomy')} {session.visionPanel.anatomy ? t(ORGAN_KEY[session.visionPanel.anatomy] ?? 'visionAnatomy') : '—'} · {t('visionPlane')} {session.visionPanel.plane && PLANE_KEY[session.visionPanel.plane] ? t(PLANE_KEY[session.visionPanel.plane]) : '—'}</p>
              <p>{t('visionConfidence')} {session.visionPanel.confidence === null ? '—' : session.visionPanel.confidence.toFixed(2)} · {t('visionTracking')} {t(TRACKING_KEY[session.visionPanel.tracking] ?? 'tracking_off')} · {t('visionProtocol')} {session.visionPanel.protocolDone} / {session.visionPanel.protocolTotal}</p>
              <p>
                {t('visionGuidance')}: {session.visionPanel.guidance === 'turn_for_view' && session.visionPanel.missingView
                  ? t('visionTurn', { view: viewTitle(module.id, session.visionPanel.missingView) })
                  : t(GUIDANCE_KEY[session.visionPanel.guidance] ?? 'visionIdle')}
              </p>
              <p>{t('visionEvidence', { frames: session.visionPanel.frames, clips: session.visionPanel.clips, observations: session.visionPanel.observations, candidates: session.visionPanel.candidates })}</p>
              {session.visionPanel.uncertainty ? <p className="hint">{text(session.visionPanel.uncertainty)}</p> : null}
            </div>
          ) : (
            <p className="hint">{session.visionOn ? t('visionIdle') : t('visionOff')}</p>
          )}
          <div className="metrics">
            <div><strong>{session.score ? session.score.qualityScore.toFixed(2) : '—'}</strong><span>{t('quality')}</span></div>
            <div><strong>{session.score ? session.score.sharpness.toFixed(2) : '—'}</strong><span>{t('sharpness')}</span></div>
            <div><strong>{session.score ? session.score.brightness.toFixed(2) : '—'}</strong><span>{t('brightness')}</span></div>
            <div><strong>{session.score ? session.score.stability.toFixed(2) : '—'}</strong><span>{t('stability')}</span></div>
            <div><strong>{session.score ? session.score.coverage.toFixed(2) : '—'}</strong><span>{t('coverage')}</span></div>
          </div>
          <p className="hint">{t('hold', { sec: (session.heldMs / 1000).toFixed(1) })}</p>
          {session.hint ? <div className="banner warn">{text(session.hint)}</div> : null}
          {session.error ? <div className="banner bad">{text(session.error)}</div> : null}
          <div className="actions">
            <button type="button" className="primary" onClick={() => void session.start()}>{session.running ? t('restart') : t('start')}</button>
            <button type="button" className="ghost" onClick={session.stop}>{t('stop')}</button>
            <button type="button" className="ghost" disabled={!session.currentView || !session.score || session.score.qualityScore < module.qualityThreshold} onClick={() => session.currentView && session.remember(session.currentView)}>
              {session.currentView ? t('capture', { view: viewTitle(module.id, session.currentView) }) : t('captureFrame')}
            </button>
          </div>
          <div className="modules">
            {module.requiredViews.map((view) => (
              <span key={view}>{viewTitle(module.id, view)}: {session.captures[view] ? t('captured') : t('waiting')}</span>
            ))}
          </div>
        </div>
        <aside className="panel side">
          <h2>{pack?.title ?? module.title}</h2>
          {!session.currentView ? (
            <p>{t('viewsDone')}</p>
          ) : session.mode === 'guided' && step ? (
            <>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {session.readWaitMs > 0 ? <p className="hint">{t('readWait', { sec: Math.ceil(session.readWaitMs / 1000) })}</p> : null}
            </>
          ) : (
            <p className="muted">{t('guidanceQuiet')}</p>
          )}
          {atlas && pack ? <p><a href={atlas.url} target="_blank" rel="noreferrer">{pack.atlas}</a></p> : null}
          <label>
            {t('question')}
            <textarea value={session.question} onChange={(event) => session.setQuestion(event.target.value)} />
          </label>
          <label>
            {t('region')}
            <input value={session.regionName} onChange={(event) => session.setRegionName(event.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={session.regionConfirmed} onChange={(event) => session.setRegionConfirmed(event.target.checked)} />
            {t('regionConfirm')}
          </label>
          <MeasurementFields
            moduleId={module.id}
            draft={session.draft}
            setDraft={session.setDraft}
            contourKey={session.contourKey}
            setContourKey={session.setContourKey}
          />
          <label className="check">
            <input type="checkbox" checked={session.calipersAttested} onChange={(event) => session.setCalipersAttested(event.target.checked)} />
            {t('calipers')}
          </label>
          <label>
            {t('dicom')}
            <input type="file" accept=".dcm,application/dicom" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void session.inspectDicom(file)
            }} />
          </label>
          <button type="button" className="ghost" onClick={() => void session.inspectDicomFolder()}>{t('dicomFolder')}</button>
          {session.pixelSpacing ? <p className="hint">{t('dicomScale', { mm: session.pixelSpacing.toFixed(4) })}</p> : null}
          {session.diameters.length > 0 ? <p className="hint">{t('ivcSeries', { values: session.diameters.join(', ') })}</p> : null}
          {session.preview ? (
            <div className="banner">
              {t('measurement')}: {session.preview.value === undefined ? t('noNumber') : `${session.preview.value.toFixed(2)} ${previewUnit}`}
              {session.preview.raw.reason ? `. ${text(String(session.preview.raw.reason))}` : ''}
            </div>
          ) : null}
          <label>
            {t('voiceNote')}
            <textarea value={session.note} onChange={(event) => session.setNote(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" className="ghost" onClick={session.toggleVoice}>{session.listening ? t('dictateStop') : t('dictate')}</button>
            <button type="button" className="primary" disabled={session.diagnosing} onClick={() => void session.diagnose()}>
              {session.diagnosing ? t('diagnosing') : t('diagnose')}
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={session.consent} onChange={(event) => session.setConsent(event.target.checked)} />
            {t('consent')}
          </label>
          <label className="check">
            <input type="checkbox" checked={session.frameConsent} onChange={(event) => session.setFrameConsent(event.target.checked)} />
            {t('frameConsent')}
          </label>
          <button type="button" className="ghost" disabled={session.frameCount === 0} onClick={session.downloadFrameLog}>
            {t('downloadFrames')} ({session.frameCount})
          </button>
        </aside>
      </section>
      {session.result ? (
        <DiagnosticReview
          result={session.result}
          onAccept={session.accept}
          onReject={session.reject}
          onLabel={session.editLabel}
          onForward={() => void session.forward()}
          forwardState={session.forwardState}
          canForward={session.canForward}
        />
      ) : null}
    </main>
  )
}