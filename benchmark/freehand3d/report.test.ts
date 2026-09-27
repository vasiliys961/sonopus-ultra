import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectStage2Report } from '@/benchmark/freehand3d/report'

describe('отчёт stage 2', () => {
  it('записывает реальный прогон, без подставленных ошибок', async () => {
    const report = await collectStage2Report()
    expect(report.translationMaeMm).toBeLessThan(0.6)
    expect(report.rotationMaeDeg).toBeNull()
    expect(report.clinicallyValidated).toBe(false)
    expect(report.outOfPlane).toBe('not-estimated')
    expect(report.timings.length).toBeGreaterThanOrEqual(6)
    const dir = path.resolve('benchmark/freehand3d/reports')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`)
    const lines = [
      '# Freehand 3D benchmark',
      '',
      'Числа ниже сняты прогоном `collectStage2Report`. Это не клиническая ошибка и не подставленный отчёт.',
      '',
      `- Pose provider for MAE: ${report.poseProvider}`,
      `- In-plane translation MAE, mm: ${report.translationMaeMm}`,
      '- Rotation MAE: not reported. These cases have no ground-truth rotation, and 2D registration does not estimate out-of-plane motion.',
      '- Surface distance and dimension error: not implemented. They are not replaced by a visual score.',
      `- Coverage of the registration pair: ${report.coverage}`,
      `- Rejected frames in that pair: ${report.rejectedFrames}`,
      `- Reconstruction time for 100 frames at 480×360, stride 4, ms: ${report.reconstructionTimeMs}`,
      `- clinicallyValidated: ${report.clinicallyValidated}`,
      '',
      '## Timings',
      '',
      ...report.timings.map((row) => `- ${row.frames} frames ${row.width}×${row.height} stride ${row.stride}: ${row.ms} ms, voxels ${row.voxels}`),
      '',
    ]
    fs.writeFileSync(path.join(dir, 'latest.md'), lines.join('\n'))
  }, 120_000)
})
