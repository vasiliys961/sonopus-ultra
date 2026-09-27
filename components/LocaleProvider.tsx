'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { copy, formatMessage, label, translateEngineText, viewTitle, type Locale, type MessageKey } from '@/lib/i18n/copy'

interface LocaleValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  text: (value: string) => string
  label: (key: Parameters<typeof label>[1]) => string
  viewTitle: (moduleId: string, view: string) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)
const STORAGE_KEY = 'sono-locale'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ru') {
      setLocaleState(saved)
      return
    }
    if (window.navigator.language.toLowerCase().startsWith('ru')) setLocaleState('ru')
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleValue>(() => {
    const setLocale = (next: Locale) => {
      window.localStorage.setItem(STORAGE_KEY, next)
      setLocaleState(next)
    }
    return {
      locale,
      setLocale,
      t: (key, vars) => formatMessage(copy[locale][key], vars),
      text: (message) => translateEngineText(locale, message),
      label: (key) => label(locale, key),
      viewTitle: (moduleId, view) => viewTitle(locale, moduleId, view),
    }
  }, [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used within LocaleProvider')
  return value
}

export function ScanFallback() {
  const { t } = useLocale()
  return <p className="pad">{t('loading')}</p>
}

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="lang" role="group" aria-label="Language">
      <button type="button" className={locale === 'en' ? 'primary' : 'ghost'} onClick={() => setLocale('en')}>
        EN
      </button>
      <button type="button" className={locale === 'ru' ? 'primary' : 'ghost'} onClick={() => setLocale('ru')}>
        RU
      </button>
    </div>
  )
}
