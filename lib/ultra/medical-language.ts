const STEMS: Array<[string, string]> = [
  ['гипо эхогенн', 'гипоэхогенн'],
  ['гипер эхогенн', 'гиперэхогенн'],
  ['изо эхогенн', 'изоэхогенн'],
  ['анэхо генн', 'анэхогенн'],
  ['ан эхогенн', 'анэхогенн'],
  ['эхо генн', 'эхогенн'],
  ['паре нхим', 'паренхим'],
  ['поренхим', 'паренхим'],
  ['холе дох', 'холедох'],
  ['холедок', 'холедох'],
  ['конкре мент', 'конкремент'],
  ['конкрэмент', 'конкремент'],
  ['дорзальн', 'дорсальн'],
  ['нижняя пола вена', 'нижняя полая вена'],
]

const WORDS: Array<[string, string]> = [
  ['нпв', 'нижняя полая вена'],
  ['члс', 'чашечно-лоханочная система'],
  ['ожп', 'общий желчный проток'],
]

const NUMBER_WORDS: Record<string, number> = {
  ноль: 0,
  один: 1, одна: 1, одно: 1,
  два: 2, две: 2,
  три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14,
  пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
}

const UNIT_WORDS: Record<string, string> = {
  мм: 'мм', миллиметр: 'мм', миллиметра: 'мм', миллиметров: 'мм',
  см: 'см', сантиметр: 'см', сантиметра: 'см', сантиметров: 'см',
  мл: 'мл', миллилитр: 'мл', миллилитра: 'мл', миллилитров: 'мл',
}

export function applyMedicalLanguage(text: string): string {
  const terms = [...STEMS, ...WORDS].sort((a, b) => b[0].length - a[0].length)
  const named = terms.reduce((current, [from, to]) => replaceTerm(current, from, to, !from.includes(' ') && from.length <= 4), text)
  return normalizeSpokenMeasures(named).replace(/\s+/g, ' ').trim()
}

export function acceptMedicalRewrite(source: string, rewritten: string): boolean {
  const next = rewritten.trim()
  if (!next) return false
  if (next.length > Math.max(source.length * 2, source.length + 400)) return false
  const sourceNumbers = numbersIn(source)
  const nextNumbers = numbersIn(next)
  return nextNumbers.every((number) => sourceNumbers.includes(number))
}

export function parseMedicalText(raw: string, source: string): string {
  const match = raw.match(/\{[\s\S]*\}/)
  const candidate = match ? readText(match[0]) : raw.trim()
  return acceptMedicalRewrite(source, candidate) ? candidate.trim() : source
}

export function medicalLanguagePrompt(text: string): string {
  return [
    'Приведи диктовку врача УЗИ к обычным терминам ультразвуковой диагностики.',
    'Верни только JSON {"text":"..."} без пояснений.',
    'Не добавляй находки, органы и диагнозы, которых нет в диктовке.',
    'Размеры, которые врач назвал, сохрани цифрами и единицами, например 62 × 28 мм. Не добавляй размер, которого врач не называл, и не меняй названное число.',
    'Не убирай сомнение, если врач его сказал.',
    text,
  ].join('\n')
}

function readText(json: string): string {
  try {
    const text = (JSON.parse(json) as { text?: unknown }).text
    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

function replaceTerm(text: string, from: string, to: string, wholeWord: boolean): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const end = wholeWord ? '(?=$|[^а-яёa-z0-9])' : ''
  const pattern = new RegExp(`(^|[^а-яёa-z0-9])(${escaped})${end}`, 'giu')
  return text.replace(pattern, (_, lead: string, sample: string) => `${lead}${matchCase(sample, to)}`)
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((number) => number.replace(',', '.'))
}

function normalizeSpokenMeasures(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let index = 0
  while (index < tokens.length) {
    const measured = takeMeasure(tokens, index)
    if (measured) {
      out.push(measured.text)
      index = measured.next
      continue
    }
    out.push(tokens[index])
    index += 1
  }
  return out.join(' ')
}

function takeMeasure(tokens: string[], start: number): { text: string; next: number } | null {
  const first = takeNumeric(tokens, start)
  if (!first) return null
  const values = [first.value]
  let index = first.next
  let suffix = first.suffix
  while (index < tokens.length && isTimes(coreOf(tokens[index]).core)) {
    const next = takeNumeric(tokens, index + 1)
    if (!next) break
    values.push(next.value)
    suffix = next.suffix
    index = next.next
  }
  const unitToken = tokens[index]
  const unit = unitToken ? UNIT_WORDS[coreOf(unitToken).core] : undefined
  if (values.length < 2 && !unit) return null
  if (unit) {
    suffix = coreOf(unitToken).suffix
    index += 1
  }
  return { text: `${values.join(' × ')}${unit ? ` ${unit}` : ''}${suffix}`, next: index }
}

function takeNumeric(tokens: string[], index: number): { value: string; next: number; suffix: string } | null {
  const token = tokens[index]
  if (!token) return null
  const { core, suffix } = coreOf(token)
  if (core === 'полтора' || core === 'полторы') return { value: '1,5', next: index + 1, suffix }
  if (/^\d+(?:[.,]\d+)?$/.test(core)) return { value: core.replace('.', ','), next: index + 1, suffix }
  const spoken = takeSpoken(tokens, index)
  if (!spoken) return null
  const bridge = tokens[spoken.next]
  if (bridge && (coreOf(bridge).core === 'целых' || coreOf(bridge).core === 'целая')) {
    const fraction = takeSpoken(tokens, spoken.next + 1)
    if (fraction && fraction.value < 10) return { value: `${spoken.value},${fraction.value}`, next: fraction.next, suffix: fraction.suffix }
  }
  return { value: String(spoken.value), next: spoken.next, suffix: spoken.suffix }
}

function takeSpoken(tokens: string[], index: number): { value: number; next: number; suffix: string } | null {
  const head = tokens[index] ? coreOf(tokens[index]) : null
  if (!head) return null
  const hundred = NUMBER_WORDS[head.core]
  let value = 0
  let used = 0
  let suffix = ''
  if (hundred != null && hundred >= 100 && hundred % 100 === 0) {
    value = hundred
    used = 1
    suffix = head.suffix
  }
  const mid = tokens[index + used] ? coreOf(tokens[index + used]) : null
  const midValue = mid ? NUMBER_WORDS[mid.core] : undefined
  if (mid && midValue != null && midValue >= 10 && midValue < 20) {
    return { value: value + midValue, next: index + used + 1, suffix: mid.suffix }
  }
  if (mid && midValue != null && midValue >= 20 && midValue < 100 && midValue % 10 === 0) {
    value += midValue
    used += 1
    suffix = mid.suffix
    const unit = tokens[index + used] ? coreOf(tokens[index + used]) : null
    const unitValue = unit ? NUMBER_WORDS[unit.core] : undefined
    if (unit && unitValue != null && unitValue >= 1 && unitValue <= 9) {
      value += unitValue
      used += 1
      suffix = unit.suffix
    }
    return { value, next: index + used, suffix }
  }
  const small = tokens[index + used] ? coreOf(tokens[index + used]) : null
  const smallValue = small ? NUMBER_WORDS[small.core] : undefined
  if (small && smallValue != null && smallValue >= 0 && smallValue <= 9) {
    return { value: value + smallValue, next: index + used + 1, suffix: small.suffix }
  }
  if (used > 0) return { value, next: index + used, suffix }
  return null
}

function coreOf(token: string): { core: string; suffix: string } {
  const match = /^([0-9]+(?:[.,][0-9]+)?|[а-яё]+)(.*)$/iu.exec(token)
  if (!match) return { core: token.toLowerCase(), suffix: '' }
  return { core: match[1].toLowerCase(), suffix: match[2] }
}

function isTimes(word: string): boolean {
  return word === 'на' || word === 'х' || word === 'x'
}

function matchCase(sample: string, replacement: string): string {
  const first = sample[0] ?? ''
  if (first !== first.toLowerCase() && first === first.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}
