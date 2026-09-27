import type { Metadata } from 'next'
import { LocaleProvider } from '@/components/LocaleProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'SonOpus ultra',
  description: 'Connect the machine, sweep the probe, receive a cine, frames, and a draft conclusion.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}
