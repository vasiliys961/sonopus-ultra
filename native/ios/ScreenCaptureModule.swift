import CoreMedia
import CoreVideo
import Foundation
import ReplayKit

/// Захват экрана стороннего приложения УЗИ. RGBA уходит в NativeUltrasoundCaptureModule.
@objc(ScreenCaptureModule)
final class ScreenCaptureModule: NSObject {
  private let recorder = RPScreenRecorder.shared()
  var onRgba: ((Data, Int, Int, Double) -> Void)?

  @objc func start() {
    recorder.startCapture(handler: { [weak self] sample, kind, error in
      guard error == nil, kind == .video, let buffer = CMSampleBufferGetImageBuffer(sample) else { return }
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
      let width = CVPixelBufferGetWidth(buffer)
      let height = CVPixelBufferGetHeight(buffer)
      guard let base = CVPixelBufferGetBaseAddress(buffer) else { return }
      let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
      var rgba = Data(count: width * height * 4)
      rgba.withUnsafeMutableBytes { raw in
        guard let destination = raw.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
        let source = base.assumingMemoryBound(to: UInt8.self)
        for y in 0..<height {
          for x in 0..<width {
            let from = y * rowBytes + x * 4
            let to = (y * width + x) * 4
            destination[to] = source[from + 2]
            destination[to + 1] = source[from + 1]
            destination[to + 2] = source[from]
            destination[to + 3] = 255
          }
        }
      }
      let seconds = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample))
      self?.onRgba?(rgba, width, height, seconds)
    }, completionHandler: nil)
  }

  @objc func stop() {
    recorder.stopCapture(handler: nil)
    onRgba = nil
  }
}
