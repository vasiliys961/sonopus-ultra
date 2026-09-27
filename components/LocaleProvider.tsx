'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { cabinetLocale, copy, formatMessage, label, translateEngineText, viewTitle, type Locale, type MessageKey } from '@/lib/i18n/copy'
import { APP_LOCALES, isLocale, isRtl, LOCALE_LABEL, matchNavigator } from '@/lib/i18n/locales'

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
    setLocaleState(isLocale(saved) ? saved : matchNavigator(window.navigator.language))
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }, [locale])

  const value = useMemo<LocaleValue>(() => {
    const setLocale = (next: Locale) => {
      window.localStorage.setItem(STORAGE_KEY, next)
      setLocaleState(next)
    }
    const shown = cabinetLocale(locale)
    return {
      locale,
      setLocale,
      t: (key, vars) => formatMessage(copy[shown][key], vars),
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
    <div className="lang">
      <label>
        <select aria-label={LOCALE_LABEL[locale]} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
          {APP_LOCALES.map((code) => (
            <option key={code} value={code}>{LOCALE_LABEL[code]}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
