import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import type { VolumeSliceSample } from '@/lib/volume-engine/types/VolumeSlice'

export interface DicomSliceGeometry {
  frameId: string
  modality: 'CT' | 'MR'
  imagePositionPatient: Vec3
  imageOrientationPatient: [number, number, number, number, number, number]
  pixelSpacing: [number, number]
  rows: number
  columns: number
  pixels: Float32Array
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

/** Абсолютная поза среза из DICOM. Файлы и зритель Doctor Opus здесь не читаются. */
export function matrixFromDicom(geometry: DicomSliceGeometry): Mat4 {
  const row: Vec3 = [
    geometry.imageOrientationPatient[0],
    geometry.imageOrientationPatient[1],
    geometry.imageOrientationPatient[2],
  ]
  const column: Vec3 = [
    geometry.imageOrientationPatient[3],
    geometry.imageOrientationPatient[4],
    geometry.imageOrientationPatient[5],
  ]
  const normal = cross(row, column)
  const [rowSpacing, columnSpacing] = geometry.pixelSpacing
  const center: Vec3 = [
    geometry.imagePositionPatient[0] + row[0] * columnSpacing * (geometry.columns / 2 - 0.5) + column[0] * rowSpacing * (geometry.rows / 2 - 0.5),
    geometry.imagePositionPatient[1] + row[1] * columnSpacing * (geometry.columns / 2 - 0.5) + column[1] * rowSpacing * (geometry.rows / 2 - 0.5),
    geometry.imagePositionPatient[2] + row[2] * columnSpacing * (geometry.columns / 2 - 0.5) + column[2] * rowSpacing * (geometry.rows / 2 - 0.5),
  ]
  return [
    row[0], column[0], normal[0], center[0],
    row[1], column[1], normal[1], center[1],
    row[2], column[2], normal[2], center[2],
    0, 0, 0, 1,
  ]
}

export function dicomSlice(geometry: DicomSliceGeometry): VolumeSliceSample {
  return {
    frameId: geometry.frameId,
    timestamp: 0,
    image: geometry.pixels,
    width: geometry.columns,
    height: geometry.rows,
    transform: matrixFromDicom(geometry),
    confidence: 1,
    pixelSpacingX: geometry.pixelSpacing[1],
    pixelSpacingY: geometry.pixelSpacing[0],
    quality: 1,
    source: 'dicom',
  }
}
