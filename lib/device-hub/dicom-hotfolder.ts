import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { inspectDicomBuffer, type DicomInspection } from '@/lib/dicom/pixel-spacing'

export interface FolderDicom {
  filePath: string
  inspection: DicomInspection
}

export async function inspectLatestDicom(dir: string): Promise<FolderDicom | null> {
  const names = await readdir(dir)
  const dicomNames = names.filter((name) => name.toLowerCase().endsWith('.dcm'))
  if (dicomNames.length === 0) return null
  const ranked = await Promise.all(
    dicomNames.map(async (name) => {
      const filePath = path.join(dir, name)
      const info = await stat(filePath)
      return { filePath, mtimeMs: info.mtimeMs }
    }),
  )
  ranked.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const newest = ranked[0]
  if (!newest) return null
  const bytes = new Uint8Array(await readFile(newest.filePath))
  return { filePath: newest.filePath, inspection: inspectDicomBuffer(bytes) }
}

export function watchDicomFolder(
  dir: string,
  onStudy: (filePath: string, inspection: DicomInspection) => void,
): { stop: () => void } {
  const seen = new Set<string>()
  let stopped = false
  const tick = async () => {
    if (stopped) return
    const names = await readdir(dir).catch(() => [] as string[])
    for (const name of names) {
      if (stopped || !name.toLowerCase().endsWith('.dcm') || seen.has(name)) continue
      seen.add(name)
      try {
        const fullPath = path.join(dir, name)
        const buffer = await readFile(fullPath)
        if (!stopped) onStudy(fullPath, inspectDicomBuffer(new Uint8Array(buffer)))
      } catch {
        seen.delete(name)
      }
    }
  }
  const timer = setInterval(() => void tick(), 400)
  void tick()
  return {
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}
