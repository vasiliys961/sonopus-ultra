import { describe, expect, it } from 'vitest'
import { APP_LOCALES, isRtl, matchNavigator, speechTag } from '@/lib/i18n/locales'
import { doctorCopy } from '@/lib/ultra/screen-copy'
import { GUIDE_CHROME } from '@/lib/ultra/guide-chrome'
import { organLabel, LOCALIZATIONS } from '@/lib/ultra/organs'
import { protocolOutline } from '@/lib/ultra/protocol-samples'
import { coachLine } from '@/lib/ultra/coach'

describe('языки как в Doctor Opus Global', () => {
  it('держит русский и десять языков Global', () => {
    expect(APP_LOCALES).toEqual(['en', 'ru', 'es', 'fr', 'ar', 'hi', 'pt-BR', 'id', 'ms', 'tr', 'zh-CN'])
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('ru')).toBe(false)
    expect(matchNavigator('pt-PT')).toBe('pt-BR')
    expect(matchNavigator('zh-Hans')).toBe('zh-CN')
    expect(matchNavigator('ru-RU')).toBe('ru')
    expect(speechTag('ar')).toBe('ar')
  })

  it('переводит экран врача, органы и подсказку прохода', () => {
    const liver = LOCALIZATIONS.find((item) => item.id === 'liver')
    expect(liver).toBeTruthy()
    for (const locale of APP_LOCALES) {
      const copy = doctorCopy(locale)
      expect(copy.steps).toHaveLength(4)
      expect(copy.machineSteps).toHaveLength(4)
      expect(copy.guide.computer.cable).toHaveLength(4)
      expect(copy.lead.length).toBeGreaterThan(8)
      if (locale !== 'en') expect(copy.lead).not.toBe(doctorCopy('en').lead)
      if (locale !== 'ru' && locale !== 'en') {
        expect(GUIDE_CHROME[locale].title).not.toBe('Capture cards for ultrasound machines')
        expect(GUIDE_CHROME[locale].between).toHaveLength(7)
      }
      expect(organLabel(liver!, locale).length).toBeGreaterThan(0)
      expect(coachLine({ score: null, moduleId: 'organ-sweep', elapsedMs: 0, locale }).length).toBeGreaterThan(8)
    }
    expect(organLabel(liver!, 'es')).toBe('Hígado')
    expect(protocolOutline('Hígado', 'en')).toMatch(/Liver/)
    expect(protocolOutline('Печень', 'ru')).toMatch(/Печень/)
  })
})