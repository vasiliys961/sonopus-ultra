'use client'

import { useEffect, useRef, useState } from 'react'
import { observedScalars } from '@/engine/medical-3d/scalars'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

function factoryOf<T>(mod: unknown): { newInstance: (options?: object) => T } | null {
  const record = mod as { default?: { newInstance?: (options?: object) => T }; newInstance?: (options?: object) => T }
  const candidate = typeof record.default?.newInstance === 'function' ? record.default : record
  return typeof candidate.newInstance === 'function' ? { newInstance: candidate.newInstance } : null
}

interface VtkImage {
  setDimensions: (x: number, y: number, z: number) => void
  setSpacing: (x: number, y: number, z: number) => void
  setOrigin: (x: number, y: number, z: number) => void
  getPointData: () => { setScalars: (values: unknown) => void }
  delete?: () => void
}

interface VtkMapper {
  setInputData: (data: VtkImage) => void
  setSampleDistance: (distance: number) => void
}

interface VtkVolume {
  setMapper: (mapper: VtkMapper) => void
  setProperty: (property: VtkProperty) => void
}

interface VtkProperty {
  setRGBTransferFunction: (index: number, fn: unknown) => void
  setScalarOpacity: (index: number, fn: unknown) => void
  setInterpolationTypeToLinear: () => void
  setShade: (on: boolean) => void
  setAmbient: (value: number) => void
  setDiffuse: (value: number) => void
}

interface VtkWindow {
  setContainer: (node: HTMLElement) => void
  resize: () => void
  getRenderer: () => { addVolume: (volume: VtkVolume) => void; resetCamera: () => void; setBackground: (r: number, g: number, b: number) => void }
  getRenderWindow: () => { render: () => void }
  delete: () => void
}

export function VtkVolume({ volume }: { volume: ReconstructedVolume }) {
  const host = useRef<HTMLDivElement>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    const node = host.current
    if (!node || volume.size[0] === 0) return
    let disposed = false
    let release = () => {}
    void mount(node, volume).then((done) => {
      if (disposed) done()
      else release = done
    }).catch((error: unknown) => {
      if (!disposed) setProblem(error instanceof Error ? error.message : 'Объёмный vtk не открылся. Срезы выше остаются.')
    })
    return () => {
      disposed = true
      release()
    }
  }, [volume])

  return (
    <figure className="spatial-volume">
      <div ref={host} className="vtk-host" />
      <figcaption>Объём vtk, та же сетка. Единицы сетки, не миллиметры пациента.</figcaption>
      {problem ? <p className="hint">{problem}</p> : null}
    </figure>
  )
}

async function mount(container: HTMLElement, volume: ReconstructedVolume): Promise<() => void> {
  await import('vtk.js/Sources/Rendering/OpenGL/Profiles/Volume')
  const [imageMod, dataMod, windowMod, volumeMod, mapperMod, propertyMod, colorMod, opacityMod] = await Promise.all([
    import('vtk.js/Sources/Common/DataModel/ImageData'),
    import('vtk.js/Sources/Common/Core/DataArray'),
    import('vtk.js/Sources/Rendering/Misc/GenericRenderWindow'),
    import('vtk.js/Sources/Rendering/Core/Volume'),
    import('vtk.js/Sources/Rendering/Core/VolumeMapper'),
    import('vtk.js/Sources/Rendering/Core/VolumeProperty'),
    import('vtk.js/Sources/Rendering/Core/ColorTransferFunction'),
    import('vtk.js/Sources/Common/DataModel/PiecewiseFunction'),
  ])
  const imageFactory = factoryOf<VtkImage>(imageMod)
  const dataFactory = factoryOf<unknown>(dataMod)
  const windowFactory = factoryOf<VtkWindow>(windowMod)
  const volumeFactory = factoryOf<VtkVolume>(volumeMod)
  const mapperFactory = factoryOf<VtkMapper>(mapperMod)
  const propertyFactory = factoryOf<VtkProperty>(propertyMod)
  const colorFactory = factoryOf<{ addRGBPoint: (x: number, r: number, g: number, b: number) => void }>(colorMod)
  const opacityFactory = factoryOf<{ addPoint: (x: number, y: number) => void }>(opacityMod)
  if (!imageFactory || !dataFactory || !windowFactory || !volumeFactory || !mapperFactory || !propertyFactory || !colorFactory || !opacityFactory) {
    throw new Error('Сборка vtk.js не содержит объёмный рендер. Срезы выше остаются.')
  }
  const image = imageFactory.newInstance()
  image.setDimensions(volume.size[0], volume.size[1], volume.size[2])
  image.setSpacing(volume.spacingMm[0] || 1, volume.spacingMm[1] || 1, volume.spacingMm[2] || 1)
  image.setOrigin(volume.originMm[0], volume.originMm[1], volume.originMm[2])
  image.getPointData().setScalars(dataFactory.newInstance({ name: 'Scalars', numberOfComponents: 1, values: observedScalars(volume) }))
  const color = colorFactory.newInstance()
  color.addRGBPoint(0, 0, 0, 0)
  color.addRGBPoint(0.25, 0.2, 0.45, 0.25)
  color.addRGBPoint(0.6, 0.55, 0.82, 0.45)
  color.addRGBPoint(1, 0.92, 1, 0.86)
  const opacity = opacityFactory.newInstance()
  opacity.addPoint(0, 0)
  opacity.addPoint(0.08, 0)
  opacity.addPoint(0.3, 0.12)
  opacity.addPoint(0.7, 0.4)
  opacity.addPoint(1, 0.72)
  const property = propertyFactory.newInstance()
  property.setRGBTransferFunction(0, color)
  property.setScalarOpacity(0, opacity)
  property.setInterpolationTypeToLinear()
  property.setShade(true)
  property.setAmbient(0.3)
  property.setDiffuse(0.7)
  const mapper = mapperFactory.newInstance()
  mapper.setSampleDistance(0.7)
  mapper.setInputData(image)
  const actor = volumeFactory.newInstance()
  actor.setMapper(mapper)
  actor.setProperty(property)
  const view = windowFactory.newInstance({ background: [0.03, 0.06, 0.05] })
  view.setContainer(container)
  view.resize()
  const renderer = view.getRenderer()
  renderer.setBackground(0.03, 0.06, 0.05)
  renderer.addVolume(actor)
  renderer.resetCamera()
  view.getRenderWindow().render()
  return () => view.delete()
}
