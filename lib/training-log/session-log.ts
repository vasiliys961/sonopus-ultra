export interface QualityLogEntry {
  organModule: string
  qualityScore: number
  timestamp: number
}

/** Память сессии. Кадры сюда не пишутся: для обучения нужна отдельная согласительная выгрузка. */
export class SessionQualityLog {
  private readonly entries: QualityLogEntry[] = []

  constructor(private readonly limit = 400) {}

  add(entry: QualityLogEntry, consent: boolean): void {
    if (!consent) return
    this.entries.push(entry)
    if (this.entries.length > this.limit) this.entries.shift()
  }

  snapshot(): QualityLogEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.length = 0
  }
}
