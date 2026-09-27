'use client'

import type { Dispatch, SetStateAction } from 'react'
import { EndocardialTracingCanvas } from '@/components/EndocardialTracingCanvas'
import { useLocale } from '@/components/LocaleProvider'
import type { MeasurementDraft } from '@/lib/ultrasound-modules/manual-draft'
import { EFAST_POINTS } from '@/lib/ultrasound-modules/efast/efast-module'
import { LUNG_ZONES } from '@/lib/ultrasound-modules/lung/lung-module'

function TripleFields({
  title,
  value,
  onChange,
}: {
  title: string
  value: MeasurementDraft['bladder']
  onChange: (next: MeasurementDraft['bladder']) => void
}) {
  const { t } = useLocale()
  const fields = [
    ['depthMm', t('depthMm')],
    ['widthMm', t('widthMm')],
    ['heightMm', t('heightMm')],
  ] as const
  return (
    <div className="row">
      <strong>{title}</strong>
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
          <input value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} inputMode="decimal" />
        </label>
      ))}
    </div>
  )
}

export function MeasurementFields({
  moduleId,
  draft,
  setDraft,
  contourKey,
  setContourKey,
}: {
  moduleId: string
  draft: MeasurementDraft
  setDraft: Dispatch<SetStateAction<MeasurementDraft>>
  contourKey: keyof MeasurementDraft['contours']
  setContourKey: (key: keyof MeasurementDraft['contours']) => void
}) {
  const { t, viewTitle } = useLocale()
  if (moduleId === 'bladder') {
    return <TripleFields title={t('bladderSizes')} value={draft.bladder} onChange={(bladder) => setDraft((prev) => ({ ...prev, bladder }))} />
  }
  if (moduleId === 'ivc') {
    return (
      <label>
        {t('ivcHelp')}
        <input value={draft.ivcDiameters} onChange={(event) => setDraft((prev) => ({ ...prev, ivcDiameters: event.target.value }))} />
      </label>
    )
  }
  if (moduleId === 'efast') {
    return (
      <div className="row">
        {EFAST_POINTS.map((point) => (
          <label key={point}>
            {viewTitle('efast', point)}
            <select
              value={draft.efast[point] === null ? '' : draft.efast[point] ? 'yes' : 'no'}
              onChange={(event) => {
                const next = event.target.value === '' ? null : event.target.value === 'yes'
                setDraft((prev) => ({ ...prev, efast: { ...prev.efast, [point]: next } }))
              }}
            >
              <option value="">{t('notMarked')}</option>
              <option value="no">{t('fluidNo')}</option>
              <option value="yes">{t('fluidYes')}</option>
            </select>
          </label>
        ))}
      </div>
    )
  }
  if (moduleId === 'lung') {
    return (
      <div className="row">
        {LUNG_ZONES.map((zone) => (
          <label key={zone}>
            {viewTitle('lung', zone)}
            <input
              value={draft.lungZones[zone] ?? ''}
              inputMode="numeric"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, lungZones: { ...prev.lungZones, [zone]: event.target.value } }))
              }
            />
          </label>
        ))}
      </div>
    )
  }
  if (moduleId === 'multi-angle') {
    return <p className="hint">{t('multiAngleHelp')}</p>
  }
  if (moduleId === 'thyroid') {
    return (
      <>
        <TripleFields title={t('rightLobe')} value={draft.thyroidRight} onChange={(thyroidRight) => setDraft((prev) => ({ ...prev, thyroidRight }))} />
        <TripleFields title={t('leftLobe')} value={draft.thyroidLeft} onChange={(thyroidLeft) => setDraft((prev) => ({ ...prev, thyroidLeft }))} />
      </>
    )
  }
  const contourNames: Array<[keyof MeasurementDraft['contours'], string]> = [
    ['a4cDiastole', t('a4cDiastole')],
    ['a4cSystole', t('a4cSystole')],
    ['a2cDiastole', t('a2cDiastole')],
    ['a2cSystole', t('a2cSystole')],
  ]
  return (
    <div>
      <div className="row">
        <label>
          {t('edv')}
          <input value={draft.edvMl} inputMode="decimal" onChange={(event) => setDraft((prev) => ({ ...prev, edvMl: event.target.value }))} />
        </label>
        <label>
          {t('esv')}
          <input value={draft.esvMl} inputMode="decimal" onChange={(event) => setDraft((prev) => ({ ...prev, esvMl: event.target.value }))} />
        </label>
      </div>
      <div className="actions">
        {contourNames.map(([key, label]) => (
          <button key={key} type="button" className={key === contourKey ? 'primary' : 'ghost'} onClick={() => setContourKey(key)}>
            {label}
          </button>
        ))}
      </div>
      <EndocardialTracingCanvas
        label={contourNames.find(([key]) => key === contourKey)?.[1] ?? t('contour')}
        points={draft.contours[contourKey]}
        onChange={(points) => setDraft((prev) => ({ ...prev, contours: { ...prev.contours, [contourKey]: points } }))}
      />
    </div>
  )
}