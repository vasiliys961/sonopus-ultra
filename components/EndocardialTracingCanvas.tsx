'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from '@/components/LocaleProvider'
import type { Point } from '@/lib/domain/types'

export function EndocardialTracingCanvas({
  points,
  label,
  onChange,
}: {
  points: Point[]
  label: string
  onChange: (points: Point[]) => void
}) {
  const { t } = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#3ecfb0'
    context.fillStyle = '#e8f6f1'
    context.lineWidth = 2
    context.beginPath()
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.stroke()
    for (const point of points) {
      context.beginPath()
      context.arc(point.x, point.y, 3, 0, Math.PI * 2)
      context.fill()
    }
  }, [points])

  return (
    <div>
      <p className="hint">
        {t('pointCount', { label, count: points.length })}
      </p>
      <canvas
        ref={canvasRef}
        className="trace"
        width={320}
        height={240}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width) * 320
          const y = ((event.clientY - rect.top) / rect.height) * 240
          onChange([...points, { x, y }])
        }}
      />
      <div className="actions">
        <button type="button" className="ghost" onClick={() => onChange(points.slice(0, -1))}>
          {t('undoPoint')}
        </button>
        <button type="button" className="ghost" onClick={() => onChange([])}>
          {t('clearPoints')}
        </button>
      </div>
    </div>
  )
}
