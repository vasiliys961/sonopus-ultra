package sono.capture

import android.app.Service
import android.content.Intent
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.IBinder

class MediaProjectionCapture(
  private val projection: MediaProjection,
  private val width: Int,
  private val height: Int,
  private val onRgba: (ByteArray, Int, Int, Long) -> Unit,
) {
  private val reader = ImageReader.newInstance(width, height, android.graphics.PixelFormat.RGBA_8888, 2)

  fun start() {
    projection.createVirtualDisplay("sono", width, height, 1, 0, reader.surface, null, null)
    reader.setOnImageAvailableListener({ imageReader ->
      val image = imageReader.acquireLatestImage() ?: return@setOnImageAvailableListener
      val buffer = image.planes[0].buffer
      val bytes = ByteArray(buffer.remaining())
      buffer.get(bytes)
      onRgba(bytes, image.width, image.height, image.timestamp)
      image.close()
    }, null)
  }

  fun stop() {
    reader.close()
    projection.stop()
  }
}

class MediaProjectionCaptureService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY
}
