'use client'

import Link from 'next/link'
import { useLocale } from '@/components/LocaleProvider'
import type { CaptureShot } from '@/components/scan/useScanSession'
import type { MessageKey } from '@/lib/i18n/copy'
import { rasterToGray } from '@/lib/quality/gray'
import { TUS_REC_LIMITATION } from '@/lib/spatial-reconstruction/types'
import { runExperimental3d } from '@/lib/vision-engine/experimental/sensorless-3d'

const STATUS_KEY: Record<'disabled' | 'degraded' | 'completed', MessageKey> = {
  disabled: 'freehand_disabled',
  degraded: 'freehand_degraded',
  completed: 'freehand_completed',
}

export function Sensorless3dPanel({ captures }: { captures: Record<string, CaptureShot> }) {
  const { t, text } = useLocale()
  const shots = Object.values(captures).sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  const result = runExperimental3d(true, shots.map((shot) => ({
    gray: rasterToGray(shot.raster),
    width: shot.raster.width,
    height: shot.raster.height,
  })), null)

  return (
    <section className="panel freehand" aria-labelledby="freehand-title">
      <h2 id="freehand-title">{t('freehandTitle')}</h2>
      <p>{t('freehandLead')}</p>
      <p className="hint">{text(TUS_REC_LIMITATION)}</p>
      <div className="metrics freehand-metrics">
        <div><strong>{shots.length}</strong><span>{t('freehandFrames')}</span></div>
        <div><strong>{t(STATUS_KEY[result.status])}</strong><span>{t('freehandStatus')}</span></div>
        <div><strong>{result.trajectory.length}</strong><span>{t('freehandTrajectory')}</span></div>
      </div>
      <p>{t('freehandVolume')}</p>
      <p className="hint">{t('freehandValidated')}</p>
      <p><Link className="primary link-button" href="/freehand">{t('freehandOpen')}</Link></p>
      {result.error ? <p className="banner warn">{text(result.error)}</p> : null}
    </section>
  )
}
