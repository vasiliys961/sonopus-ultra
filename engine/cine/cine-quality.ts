import type { FrameQuality } from '@/types/spatial-ultrasound'

export function qualityFromGray(gray: Float32Array, overall: number): FrameQuality {
  const count = gray.length
  if (count === 0) {
    return { overall: 0, sharpness: 0, contrast: 0, brightness: 0, artifactLevel: 1, usable: false }
  }
  let sum = 0
  let sumSq = 0
  for (let index = 0; index < count; index += 1) {
    const value = gray[index] ?? 0
    sum += value
    sumSq += value * value
  }
  const brightness = sum / count
  const variance = Math.max(0, sumSq / count - brightness * brightness)
  const contrast = Math.max(0, Math.min(1, Math.sqrt(variance) * 3))
  const artifactLevel = brightness < 0.04 || brightness > 0.97 ? 0.85 : Math.max(0, 0.35 - contrast)
  return {
    overall: Math.max(0, Math.min(1, overall)),
    sharpness: Math.max(0, Math.min(1, variance * 8)),
    contrast,
    brightness,
    artifactLevel,
    usable: overall >= 0.2 && brightness > 0.03 && brightness < 0.98 && artifactLevel < 0.8,
  }
}
