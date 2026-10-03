/** Скаляры для vtkImageData: ненаблюдаемые воксели гасятся, интерполяция не выдаётся за эхо. */
export function observedScalars(volume: { scalars: ArrayLike<number>; observed: ArrayLike<number> }): Float32Array {
  const values = new Float32Array(volume.scalars.length)
  for (let index = 0; index < values.length; index += 1) {
    values[index] = volume.observed[index] === 1 ? (volume.scalars[index] ?? 0) : 0
  }
  return values
}
