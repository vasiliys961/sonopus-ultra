import type { VisionFrameInput } from '@/lib/vision-engine/types'
import type { VisionProvider } from '@/lib/vision-engine/providers/vision-provider'

export interface BenchmarkCase {
  id: string
  frames: VisionFrameInput[]
  expectedLabel: string
}

export interface BenchmarkReport {
  kind: 'perception_agreement'
  clinicallyValidated: false
  rows: Array<{ provider: string; agreed: number; total: number }>
}

export async function compareProviders(providers: readonly VisionProvider[], cases: readonly BenchmarkCase[]): Promise<BenchmarkReport> {
  const rows = []
  for (const provider of providers) {
    let agreed = 0
    for (const item of cases) {
      const response = await provider.analyzeFrames(item.frames, 2)
      if (response.observations.some((observation) => observation.label === item.expectedLabel)) agreed += 1
    }
    rows.push({ provider: provider.id, agreed, total: cases.length })
  }
  return { kind: 'perception_agreement', clinicallyValidated: false, rows }
}
