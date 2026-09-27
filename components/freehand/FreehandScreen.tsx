'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { referenceDisplayPhantom, sensorlessUnavailable } from '@/lib/sono-3d/phantom'
import { middleObservedIndex, orthogonalSlice, type OrthogonalSlice } from '@/lib/sono-3d/slice'
import { physicalMeasuresAllowed } from '@/lib/sono-3d/types'
import { TUS_REC_LIMITATION } from '@/lib/spatial-reconstruction/types'

function SliceCanvas({ slice }: { slice: OrthogonalSlice }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = slice.width
    canvas.height = slice.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.putImageData(new ImageData(new Uint8ClampedArray(slice.rgba), slice.width, slice.height), 0, 0)
  }, [slice])
  return <canvas ref={ref} />
}

export function FreehandScreen() {
  const { t, text } = useLocale()
  const volume = referenceDisplayPhantom()
  const missing = sensorlessUnavailable()
  const observed = volume.observed.reduce((sum, bit) => sum + bit, 0)
  const slices = (['z', 'y', 'x'] as const).map((axis) => orthogonalSlice(volume, axis, middleObservedIndex(volume, axis)))
  const titles = [t('freehandSliceAxial'), t('freehandSliceCoronal'), t('freehandSliceSagittal')]
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="brand"><Link href="/">DOCTOR OPUS <span>SONO</span></Link></p>
          <h1>{t('freehandTitle')}</h1>
        </div>
        <div className="top-tools">
          <LanguageSwitch />
          <Link href="/">{t('freehandBack')}</Link>
        </div>
      </header>
      <section className="panel freehand">
        <h2>{t('freehandTestMode')}</h2>
        <p>{t('freehandNotPatient')}</p>
        <p className="hint">{t('freehandValidated')} {physicalMeasuresAllowed(volume) ? `· ${volume.spacingMm} mm` : ''}</p>
        <p>{t('freehandObserved')}: {observed}</p>
        <div className="freehand-slices">
          {slices.map((slice, index) => (
            <figure key={slice.axis}>
              <SliceCanvas slice={slice} />
              <figcaption>{titles[index]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="panel freehand">
        <h2>{t('freehandSensorlessMode')}</h2>
        <p className="banner warn">{t('freehandUnavailable')}</p>
        <p className="hint">{text(TUS_REC_LIMITATION)}</p>
        <p className="hint">{missing.code}</p>
      </section>
    </main>
  )
}
