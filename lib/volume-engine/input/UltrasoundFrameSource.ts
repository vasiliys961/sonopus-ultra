export interface UltrasoundFrame {
  frameId: string
  timestamp: number
  image: Float32Array
  width: number
  height: number
  pixelSpacingX?: number
  pixelSpacingY?: number
  quality?: number
}

/** Источник кадров. Движок объёма не знает производителя аппарата. */
export interface UltrasoundFrameSource {
  readonly id: string
  next(): Promise<UltrasoundFrame | null>
}

export interface UltrasoundDeviceAdapter {
  readonly id: string
  open(): Promise<UltrasoundFrameSource>
}

export class SyntheticFrameSource implements UltrasoundFrameSource {
  private cursor = 0

  constructor(readonly id: string, private readonly frames: readonly UltrasoundFrame[]) {}

  async next(): Promise<UltrasoundFrame | null> {
    const frame = this.frames[this.cursor]
    this.cursor += 1
    return frame ?? null
  }
}

export class SyntheticDeviceAdapter implements UltrasoundDeviceAdapter {
  constructor(readonly id: string, private readonly frames: readonly UltrasoundFrame[]) {}

  async open(): Promise<UltrasoundFrameSource> {
    return new SyntheticFrameSource(this.id, this.frames)
  }
}
