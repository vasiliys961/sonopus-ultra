declare module 'vtk.js' {
  const vtk: unknown
  export default vtk
}

declare module 'vtk.js/Sources/*' {
  const value: {
    newInstance?: (options?: object) => unknown
    default?: { newInstance?: (options?: object) => unknown }
  }
  export default value
  export function newInstance(options?: object): unknown
}
