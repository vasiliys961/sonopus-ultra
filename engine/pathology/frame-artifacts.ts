import type { ArtifactNote } from '@/types/pathology'

interface Plane {
  gray: Float32Array
  width: number
  height: number
}

/** Полосы, тёмный столб и пустой кадр. Это не очаг. */
export function scanFrameArtifacts(planes: readonly Plane[]): ArtifactNote[] {
  const notes: ArtifactNote[] = []
  if (planes.some(reverberation)) {
    notes.push({ id: 'artifact-reverb', label: 'повторяющиеся полосы, похоже на реверберацию', voxelCount: 0 })
  }
  if (planes.some(dropout)) {
    notes.push({ id: 'artifact-dropout', label: 'тёмный столб внутри кадра, похоже на выпадение сигнала', voxelCount: 0 })
  }
  if (planes.some(poorContact)) {
    notes.push({ id: 'artifact-contact', label: 'кадр почти пустой, похоже на плохой контакт', voxelCount: 0 })
  }
  return notes
}

function reverberation(plane: Plane): boolean {
  const means = rowMeans(plane)
  if (means.length < 8 || variance(means) < 0.004) return false
  for (let lag = 2; lag <= 6; lag += 1) {
    let close = 0
    let count = 0
    for (let index = 0; index + lag < means.length; index += 1) {
      count += 1
      if (Math.abs((means[index] ?? 0) - (means[index + lag] ?? 0)) < 0.05) close += 1
    }
    if (count > 0 && close / count > 0.82) return true
  }
  return false
}

function dropout(plane: Plane): boolean {
  if (plane.width < 8 || plane.height < 8) return false
  const overall = mean(plane.gray)
  if (overall < 0.08) return false
  for (let x = 2; x < plane.width - 2; x += 1) {
    let sum = 0
    for (let y = 0; y < plane.height; y += 1) sum += plane.gray[y * plane.width + x] ?? 0
    if (sum / plane.height < overall * 0.28) return true
  }
  return false
}

function poorContact(plane: Plane): boolean {
  return plane.gray.length > 0 && mean(plane.gray) < 0.035
}

function rowMeans(plane: Plane): number[] {
  const means: number[] = []
  for (let y = 0; y < plane.height; y += 1) {
    let sum = 0
    for (let x = 0; x < plane.width; x += 1) sum += plane.gray[y * plane.width + x] ?? 0
    means.push(plane.width === 0 ? 0 : sum / plane.width)
  }
  return means
}

function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let index = 0; index < values.length; index += 1) sum += values[index] ?? 0
  return sum / values.length
}

function variance(values: readonly number[]): number {
  if (values.length === 0) return 0
  const center = mean(values)
  let sum = 0
  for (const value of values) sum += (value - center) ** 2
  return sum / values.length
}
