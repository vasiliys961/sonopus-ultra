/** До поиска очага: есть принятые срезы и хотя бы один годный кадр. */
export function admitPathology(frames: readonly { quality: { usable: boolean } }[], accepted: number): boolean {
  return accepted > 0 && frames.some((frame) => frame.quality.usable)
}
