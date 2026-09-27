import { NextResponse } from 'next/server'
import { inspectLatestDicom } from '@/lib/device-hub/dicom-hotfolder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const dir = process.env.DICOM_HOTFOLDER?.trim()
  if (!dir) {
    return NextResponse.json({ calibration: 'unavailable', reason: 'папка DICOM не настроена' }, { status: 404 })
  }
  try {
    const found = await inspectLatestDicom(dir)
    if (!found) {
      return NextResponse.json({ calibration: 'unavailable', reason: 'в папке нет DICOM-файла' }, { status: 404 })
    }
    return NextResponse.json({
      fileName: found.filePath.split(/[\\/]/).pop(),
      ...found.inspection,
    })
  } catch {
    return NextResponse.json({ calibration: 'unavailable', reason: 'папку DICOM прочитать не удалось' }, { status: 400 })
  }
}
