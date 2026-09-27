'use client'

import { Suspense } from 'react'
import { UltraScreen } from '@/components/ultra/UltraScreen'

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <UltraScreen />
    </Suspense>
  )
}
