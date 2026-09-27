import { transformPoint } from '@/lib/spatial-reconstruction/rigid'
import type { Mat4, Vec3 } from '@/lib/spatial-reconstruction/types'
import { voxelIndex } from '@/lib/volume-engine/core/VolumeBuilder'
import { middleObservedIndex, orthogonalSlice, type OrthogonalSlice, type SliceAxis } from '@/lib/volume-engine/rendering/SliceRenderer'
import { cameraOnVolume, type VolumeCamera } from '@/lib/volume-engine/rendering/VolumeCamera'
import type { TrajectoryPoint } from '@/lib/volume-engine/trajectory/Trajectory'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

export interface VolumeView {
  camera: VolumeCamera
  axial: OrthogonalSlice
  coronal: OrthogonalSlice
  sagittal: OrthogonalSlice
  probe: OrthogonalSlice | null
  trajectory: Vec3[]
}

/**
 * Doctor Opus рисует КТ и МРТ в components/Dicom3DViewer по DICOM-файлам.
 * Этот рендерер принимает уже собранный ReconstructedVolume и не копирует тот зритель.
 */
export function renderVolume(volume: ReconstructedVolume, probe?: Mat4 | null): VolumeView {
  return {
    camera: cameraOnVolume(volume.originMm, volume.size, volume.spacingMm),
    axial: orthogonalSlice(volume, 'z', middleObservedIndex(volume, 'z')),
    coronal: orthogonalSlice(volume, 'y', middleObservedIndex(volume, 'y')),
    sagittal: orthogonalSlice(volume, 'x', middleObservedIndex(volume, 'x')),
    probe: probe ? probePlane(volume, probe) : null,
    trajectory: [],
  }
}

export function trajectoryPath(points: readonly TrajectoryPoint[]): Vec3[] {
  return points.map((point) => [point.matrix[3], point.matrix[7], point.matrix[11]])
}

export function renderVolumeWithTrajectory(volume: ReconstructedVolume, points: readonly TrajectoryPoint[], probe?: Mat4 | null): VolumeView {
  return { ...renderVolume(volume, probe), trajectory: trajectoryPath(points) }
}

function probePlane(volume: ReconstructedVolume, probe: Mat4): OrthogonalSlice {
  const width = 32
  const height = 32
  const rgba = new Uint8ClampedArray(width * height * 4)
  const span = Math.max(volume.spacingMm[0], volume.spacingMm[1], 1) * 8
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const local: Vec3 = [(col - width / 2) * (span / width), (row - height / 2) * (span / height), 0]
      const world = transformPoint(probe, local)
      const ix = Math.round((world[0] - volume.originMm[0]) / (volume.spacingMm[0] || 1))
      const iy = Math.round((world[1] - volume.originMm[1]) / (volume.spacingMm[1] || 1))
      const iz = Math.round((world[2] - volume.originMm[2]) / (volume.spacingMm[2] || 1))
      if (ix < 0 || iy < 0 || iz < 0 || ix >= volume.size[0] || iy >= volume.size[1] || iz >= volume.size[2]) continue
      const cell = voxelIndex(volume.size, ix, iy, iz)
      if (volume.observed[cell] !== 1) continue
      const tone = Math.max(0, Math.min(255, Math.round((volume.scalars[cell] ?? 0) * 255)))
      const pixel = (row * width + col) * 4
      rgba[pixel] = tone
      rgba[pixel + 1] = tone
      rgba[pixel + 2] = tone
      rgba[pixel + 3] = 255
    }
  }
  return { axis: 'z', index: 0, width, height, rgba }
}

export type { SliceAxis }
