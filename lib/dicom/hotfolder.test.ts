import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ultrasoundConnector } from '@/lib/dicom/catalog'
import { buildPixelSpacingDicom } from '@/lib/dicom/synthetic-dicom'
import { inspectLatestDicom, watchDicomFolder } from '@/lib/device-hub/dicom-hotfolder'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'sono-dcm-'))
  dirs.push(dir)
  return dir
}

describe('папка DICOM', () => {
  it('описывает ультразвуковой коннектор как слежение за папкой', () => {
    expect(ultrasoundConnector).toMatchObject({
      id: 'hotfolder-us-dicom',
      modality: 'ultrasound',
      connectorType: 'filewatch',
    })
  })

  it('берёт шкалу из самого нового файла в папке', async () => {
    const dir = await tempDir()
    await writeFile(path.join(dir, 'frame.dcm'), buildPixelSpacingDicom(0.2, 0.2))
    const found = await inspectLatestDicom(dir)
    expect(found?.inspection.calibration).toBe('verified')
    expect(found?.inspection.mmPerPixel).toBeCloseTo(0.2)
  })

  it('замечает файл, который появился после запуска слежения', async () => {
    const dir = await tempDir()
    const seen = new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        handle.stop()
        reject(new Error('файл не замечен'))
      }, 2000)
      const handle = watchDicomFolder(dir, (_file, inspection) => {
        clearTimeout(timer)
        handle.stop()
        resolve(inspection.mmPerPixel)
      })
    })
    await writeFile(path.join(dir, 'live.dcm'), buildPixelSpacingDicom(0.15, 0.15))
    await expect(seen).resolves.toBeCloseTo(0.15)
  })
})
