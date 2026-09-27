import { dictationLine } from '@/lib/ultra/dictation'
import { acceptMedicalRewrite, applyMedicalLanguage } from '@/lib/ultra/medical-language'

export async function polishDictation(raw: string): Promise<string> {
  const local = applyMedicalLanguage(dictationLine(raw))
  if (!local) return ''
  try {
    const response = await fetch('/api/sono/medical-language', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: local }),
    })
    if (!response.ok) return local
    const payload = (await response.json()) as { text?: unknown }
    const text = typeof payload.text === 'string' ? payload.text.trim() : ''
    return acceptMedicalRewrite(local, text) ? text : local
  } catch {
    return local
  }
}
