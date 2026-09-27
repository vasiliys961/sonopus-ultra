import { describe, expect, it } from 'vitest'
import { copy, moduleCopy, translateEngineText, type CabinetLocale } from '@/lib/i18n/copy'

const anatomical = /угол|глубин|орган|датчик|angle|organ|probe|transducer/i

describe('языки интерфейса', () => {
  it('даёт английскому и русскому один и тот же набор фраз', () => {
    expect(Object.keys(copy.ru).sort()).toEqual(Object.keys(copy.en).sort())
    expect(Object.keys(moduleCopy.ru).sort()).toEqual(Object.keys(moduleCopy.en).sort())
  })

  it('переводит служебные фразы движка и оставляет русский текст русским', () => {
    const source = 'Кадр ниже порога качества. В модель он не отправляется.'
    expect(translateEngineText('ru', source)).toBe(source)
    expect(translateEngineText('en', source)).toMatch(/quality threshold/)
    expect(translateEngineText('en', 'Гипотеза «задержка» отклонена: нет наблюдения с реальной привязкой к кадру.')).toMatch(/Hypothesis/)
  })

  it('не превращает технические подсказки в анатомические ни на одном языке', () => {
    const locales: CabinetLocale[] = ['en', 'ru']
    for (const locale of locales) {
      for (const module of Object.values(moduleCopy[locale])) {
        expect(module.title).not.toMatch(anatomical)
      }
    }
    expect(translateEngineText('en', 'Кадр нерезкий.')).not.toMatch(anatomical)
    expect(translateEngineText('ru', 'Слишком резкое движение.')).not.toMatch(anatomical)
  })
})