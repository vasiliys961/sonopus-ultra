import { describe, expect, it } from 'vitest'
import { coachLine } from '@/lib/ultra/coach'
import { dictationLine } from '@/lib/ultra/dictation'
import { acceptMedicalRewrite, applyMedicalLanguage, parseMedicalText } from '@/lib/ultra/medical-language'
import { LOCALIZATIONS } from '@/lib/ultra/organs'
import { protocolOutline, protocolSampleIds } from '@/lib/ultra/protocol-samples'
import { composeSeries, trimPass } from '@/lib/ultra/pass-loop'
import { parseKeepIds } from '@/lib/ultra/pick-frames'
import { selectSeries } from '@/lib/ultra/select-series'

const clear = { sharpness: 1, brightness: 1, stability: 1, coverage: 1, qualityScore: 1 }

describe('selectSeries', () => {
  it('берёт не больше шестнадцати кадров и держит паузу между ними', () => {
    const shots = Array.from({ length: 40 }, (_, index) => ({
      qualityScore: 0.9,
      timestamp: index * 100,
      sequenceNumber: index,
    }))
    const series = selectSeries(shots)
    expect(series.length).toBeLessThanOrEqual(16)
    for (let index = 1; index < series.length; index += 1) {
      expect(series[index].timestamp - series[index - 1].timestamp).toBeGreaterThanOrEqual(400)
    }
    expect(series.map((shot) => shot.timestamp)).toEqual([...series].sort((a, b) => a.timestamp - b.timestamp).map((shot) => shot.timestamp))
  })
})

describe('петля прохода', () => {
  it('держит десять минут и не выбрасывает отмеченный кадр', () => {
    const shots = [
      { timestamp: 0, pinned: true, qualityScore: 1, sequenceNumber: 1 },
      { timestamp: 30_000, pinned: false, qualityScore: 1, sequenceNumber: 2 },
      { timestamp: 11 * 60_000, pinned: false, qualityScore: 1, sequenceNumber: 3 },
    ]
    const kept = trimPass(shots)
    expect(kept.map((shot) => shot.sequenceNumber)).toEqual([1, 3])
  })

  it('сначала берёт кадры врача и не длиннее шестнадцати', () => {
    const shots = Array.from({ length: 30 }, (_, index) => ({
      qualityScore: 0.9,
      timestamp: index * 1000,
      sequenceNumber: index,
      pinned: index === 4,
    }))
    const series = composeSeries(shots)
    expect(series.length).toBeLessThanOrEqual(16)
    expect(series.some((shot) => shot.sequenceNumber === 4)).toBe(true)
  })

  it('принимает только id из присланной пачки', () => {
    expect(parseKeepIds('{"keep":["pass-2","нет"]}', new Set(['pass-2']), 16)).toEqual(['pass-2'])
  })
})

describe('coachLine', () => {
  it('для вены просит ослабить нажатие', () => {
    expect(coachLine({ score: clear, moduleId: 'ivc', elapsedMs: 0, locale: 'ru' })).toBe('Ослабьте нажатие. Сосуд сжимается.')
  })

  it('даёт стандартные локализации живота, лёгких и сердца отдельными органами', () => {
    const names = LOCALIZATIONS.map((item) => item.ru)
    expect(names).toEqual(expect.arrayContaining(['Печень', 'Желчный пузырь', 'Селезёнка', 'Правая почка', 'Лёгкие', 'Сердце', 'Щитовидная железа']))
    expect(LOCALIZATIONS.find((item) => item.id === 'liver')?.moduleId).toBe('organ-sweep')
    expect(LOCALIZATIONS.find((item) => item.id === 'lung')?.moduleId).toBe('lung')
  })

  it('приводит разговорное распознавание к терминам УЗИ и не добавляет размеры', () => {
    expect(applyMedicalLanguage('гипо эхогенный участок, эхо генность паренхимы обычная')).toBe('гипоэхогенный участок, эхогенность паренхимы обычная')
    expect(applyMedicalLanguage('НПВ не расширена, ЧЛС не расширена')).toBe('Нижняя полая вена не расширена, Чашечно-лоханочная система не расширена')
    expect(applyMedicalLanguage('дорзальное усиление, холедок')).toBe('дорсальное усиление, холедох')
    expect(applyMedicalLanguage('желчный шестьдесят два на двадцать восемь миллиметров')).toBe('желчный 62 × 28 мм')
    expect(applyMedicalLanguage('толщина стенки три мм, объём полтора миллилитра')).toBe('толщина стенки 3 мм, объём 1,5 мл')
    expect(applyMedicalLanguage('два контура ровные')).toBe('два контура ровные')
    expect(acceptMedicalRewrite('62 × 28 мм', '62 × 28 мм')).toBe(true)
    expect(acceptMedicalRewrite('контур ровный', 'контур ровный, 12 мм')).toBe(false)
    expect(parseMedicalText('{"text":"паренхима однородная"}', 'паренхима однородная')).toBe('паренхима однородная')
    expect(parseMedicalText('{"text":"киста 4 см"}', 'печень однородная')).toBe('печень однородная')
  })

  it('убирает команду снимка из диктовки', () => {
    expect(dictationLine('печень однородная снимок контур ровный')).toBe('печень однородная контур ровный')
    expect(dictationLine('snapshot only')).toBe('only')
    expect(dictationLine('снимок')).toBe('')
  })

  it('для нескольких взглядов говорит, что угол не измеряет', () => {
    expect(coachLine({ score: clear, moduleId: 'multi-angle', elapsedMs: 0, locale: 'ru' })).toContain('угол не измеряет')
  })
})

describe('образцы протоколов', () => {
  it('есть русский и английский образец на каждую локализацию и в нём нет чисел', () => {
    expect(protocolSampleIds()).toEqual(LOCALIZATIONS.map((item) => item.id))
    for (const item of LOCALIZATIONS) {
      const ru = protocolOutline(item.ru, 'ru')
      const en = protocolOutline(item.en, 'en')
      expect(ru).toMatch(/Заключение/)
      expect(en).toMatch(/Conclusion/)
      expect(ru).not.toMatch(/\d/)
      expect(en).not.toMatch(/\d/)
      expect(ru).not.toBe(en)
    }
  })

  it('незнакомую область ведёт общим оглавлением на языке экрана', () => {
    expect(protocolOutline('своя область', 'en')).toMatch(/Conclusion/)
    expect(protocolOutline(undefined, 'ru')).toMatch(/Заключение/)
  })
})
