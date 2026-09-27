'use client'

import { useLocale } from '@/components/LocaleProvider'
import type { DiagnosticResult } from '@/lib/domain/types'

export function DiagnosticReview({
  result,
  onAccept,
  onReject,
  onLabel,
  onForward,
  forwardState,
  canForward,
}: {
  result: DiagnosticResult
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onLabel: (id: string, label: string) => void
  onForward: () => void
  forwardState: string
  canForward: boolean
}) {
  const { t, text, label } = useLocale()
  const tone = result.outcome === 'hypotheses_available' ? 'ok' : result.outcome === 'error' ? 'bad' : 'warn'
  return (
    <section className="panel review">
      <h2>{t('reviewTitle')}</h2>
      <div className={`banner ${tone}`}>{label(result.outcome)}</div>
      {result.qualityLimitations?.map((reason) => (
        <p key={reason}>{text(reason)}</p>
      ))}
      {result.whyCannotAssess?.map((reason) => (
        <p key={reason}>{text(reason)}</p>
      ))}
      <h3>{t('observations')}</h3>
      {result.observations.length === 0 ? <p className="muted">{t('noObservations')}</p> : null}
      {result.observations.map((item) => (
        <p key={item.id}>
          {item.feature} — {label(item.polarity)}. {t('frames')}: {item.evidence.map((ref) => ref.evidenceId).join(', ')}
        </p>
      ))}
      <h3>{t('differential')}</h3>
      {result.differential.length === 0 ? <p className="muted">{t('noDifferential')}</p> : null}
      {result.differential.map((item) => (
        <article key={item.id} className="dx">
          <header>
            <strong>{label(item.priority)}</strong>
            <span>{item.status === 'operator_accepted' ? t('accepted') : item.status === 'operator_rejected' ? t('rejected') : t('draft')}</span>
          </header>
          <label>
            {t('wording')}
            <input value={item.label} onChange={(event) => onLabel(item.id, event.target.value)} disabled={item.status !== 'model_proposed'} />
          </label>
          <p className="hint">{t('forLabel')}: {item.supportingObservationIds.join(', ') || '—'}</p>
          <p className="hint">{t('against')}: {item.contradictingObservationIds.join(', ') || '—'}</p>
          {item.limitations.length > 0 ? <p className="hint">{item.limitations.map((item) => text(item)).join(' ')}</p> : null}
          <div className="actions">
            <button type="button" className="primary" onClick={() => onAccept(item.id)}>{t('accept')}</button>
            <button type="button" className="danger" onClick={() => onReject(item.id)}>{t('reject')}</button>
          </div>
        </article>
      ))}
      <div className="actions">
        <button type="button" className="primary" disabled={!canForward} onClick={onForward}>
          {t('forward')}
        </button>
        {forwardState ? <span className="hint">{text(forwardState)}</span> : null}
      </div>
    </section>
  )
}