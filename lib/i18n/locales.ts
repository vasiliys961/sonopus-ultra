export const APP_LOCALES = ['en', 'ru', 'es', 'fr', 'ar', 'hi', 'pt-BR', 'id', 'ms', 'tr', 'zh-CN'] as const

export type Locale = (typeof APP_LOCALES)[number]

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
  hi: 'हिन्दी',
  'pt-BR': 'Português (BR)',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  tr: 'Türkçe',
  'zh-CN': '简体中文',
}

const SPEECH: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar',
  hi: 'hi-IN',
  'pt-BR': 'pt-BR',
  id: 'id-ID',
  ms: 'ms-MY',
  tr: 'tr-TR',
  'zh-CN': 'zh-CN',
}

export function isLocale(value: string | null | undefined): value is Locale {
  return APP_LOCALES.includes(value as Locale)
}

export function matchNavigator(language: string): Locale {
  const value = language.toLowerCase()
  if (value.startsWith('zh')) return 'zh-CN'
  if (value.startsWith('pt')) return 'pt-BR'
  const base = value.split('-')[0]
  return APP_LOCALES.find((code) => code.toLowerCase() === value || code.toLowerCase().split('-')[0] === base) ?? 'en'
}

export function speechTag(locale: Locale): string {
  return SPEECH[locale]
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar'
}
