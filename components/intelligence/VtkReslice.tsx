'use client'

import { useEffect, useRef, useState } from 'react'
import { observedScalars } from '@/engine/medical-3d/scalars'
import type { ReconstructedVolume } from '@/lib/volume-engine/types/VolumeTypes'

function factoryOf<T>(mod: unknown): { newInstance: (options?: object) => T } | null {
  const record = mod as { default?: { newInstance?: (options?: object) => T }; newInstance?: (options?: object) => T }
  const candidate = typeof record.default?.newInstance === 'function' ? record.default : record
  return typeof candidate.newInstance === 'function' ? { newInstance: candidate.newInstance } : null
}

interface Plane {
  setNormal: (x: number, y: number, z: number) => void
  setOrigin: (x: number, y: number, z: number) => void
}

interface Handle {
  move: (index: number) => void
  release: () => void
}

export function VtkReslice({ volume, index }: { volume: ReconstructedVolume; index: number }) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<Handle | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    const node = host.current
    if (!node || volume.size[0] === 0) return
    let disposed = false
    void mount(node, volume, index).then((next) => {
      if (disposed) next.release()
      else handle.current = next
    }).catch((error: unknown) => {
      if (!disposed) setProblem(error instanceof Error ? error.message : 'Срез vtk не открылся. Срезы холста остаются.')
    })
    return () => {
      disposed = true
      handle.current?.release()
      handle.current = null
    }
  }, [volume])

  useEffect(() => {
    handle.current?.move(index)
  }, [index])

  return (
    <figure className="spatial-volume">
      <div ref={host} className="vtk-host" />
      <figcaption>Срез vtk, RECONSTRUCTED. Единицы сетки, не миллиметры пациента.</figcaption>
      {problem ? <p className="hint">{problem}</p> : null}
    </figure>
  )
}

async function mount(container: HTMLElement, volume: ReconstructedVolume, index: number): Promise<Handle> {
  await import('vtk.js/Sources/Rendering/OpenGL/Profiles/Volume')
  const [imageMod, dataMod, planeMod, mapperMod, sliceMod, windowMod] = await Promise.all([
    import('vtk.js/Sources/Common/DataModel/ImageData'),
    import('vtk.js/Sources/Common/Core/DataArray'),
    import('vtk.js/Sources/Common/DataModel/Plane'),
    import('vtk.js/Sources/Rendering/Core/ImageResliceMapper'),
    import('vtk.js/Sources/Rendering/Core/ImageSlice'),
    import('vtk.js/Sources/Rendering/Misc/GenericRenderWindow'),
  ])
  const imageFactory = factoryOf<{ setDimensions: (x: number, y: number, z: number) => void; setSpacing: (x: number, y: number, z: number) => void; setOrigin: (x: number, y: number, z: number) => void; getPointData: () => { setScalars: (values: unknown) => void } }>(imageMod)
  const dataFactory = factoryOf<unknown>(dataMod)
  const planeFactory = factoryOf<Plane>(planeMod)
  const mapperFactory = factoryOf<{ setInputData: (data: unknown) => void; setSlicePlane: (plane: Plane) => void }>(mapperMod)
  const sliceFactory = factoryOf<{ setMapper: (mapper: unknown) => void; getProperty: () => { setColorWindow: (value: number) => void; setColorLevel: (value: number) => void } }>(sliceMod)
  const windowFactory = factoryOf<{ setContainer: (node: HTMLElement) => void; resize: () => void; getRenderer: () => { addActor: (actor: unknown) => void; resetCamera: () => void; setBackground: (r: number, g: number, b: number) => void }; getRenderWindow: () => { render: () => void }; delete: () => void }>(windowMod)
  if (!imageFactory || !dataFactory || !planeFactory || !mapperFactory || !sliceFactory || !windowFactory) {
    throw new Error('Сборка vtk.js не содержит reslice. Срезы холста остаются.')
  }
  const image = imageFactory.newInstance()
  image.setDimensions(volume.size[0], volume.size[1], volume.size[2])
  image.setSpacing(volume.spacingMm[0] || 1, volume.spacingMm[1] || 1, volume.spacingMm[2] || 1)
  image.setOrigin(volume.originMm[0], volume.originMm[1], volume.originMm[2])
  image.getPointData().setScalars(dataFactory.newInstance({ name: 'Scalars', numberOfComponents: 1, values: observedScalars(volume) }))
  const plane = planeFactory.newInstance()
  plane.setNormal(0, 0, 1)
  const mapper = mapperFactory.newInstance()
  mapper.setInputData(image)
  mapper.setSlicePlane(plane)
  const actor = sliceFactory.newInstance()
  actor.setMapper(mapper)
  const property = actor.getProperty()
  property.setColorWindow(1)
  property.setColorLevel(0.5)
  const view = windowFactory.newInstance({ background: [0.03, 0.06, 0.05] })
  view.setContainer(container)
  view.resize()
  const renderer = view.getRenderer()
  renderer.setBackground(0.03, 0.06, 0.05)
  renderer.addActor(actor)
  const place = (at: number) => {
    const spacing = volume.spacingMm[2] || 1
    const z = volume.originMm[2] + Math.max(0, at) * spacing
    plane.setOrigin(volume.originMm[0] + volume.size[0] / 2, volume.originMm[1] + volume.size[1] / 2, z)
    renderer.resetCamera()
    view.getRenderWindow().render()
  }
  place(index)
  return { move: place, release: () => view.delete() }
}
