package expo.modules.vault

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream

/**
 * Rasterises PDF pages to JPEG files so the viewer only ever deals with
 * images. Rendering happens from a decrypted temporary copy and the output
 * lives in the cache directory next to the other decrypted previews.
 */
object PdfPages {
    fun render(source: File, maxPixelSize: Int, directory: File): List<Map<String, Any>> {
        directory.mkdirs()
        val pages = mutableListOf<Map<String, Any>>()
        ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                for (index in 0 until renderer.pageCount) {
                    renderer.openPage(index).use { page ->
                        val scale = maxPixelSize.toFloat() / maxOf(page.width, page.height, 1)
                        val width = maxOf(1, (page.width * scale).toInt())
                        val height = maxOf(1, (page.height * scale).toInt())
                        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        val file = File(directory, "page_${index + 1}.jpg")
                        FileOutputStream(file).use { output ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, output)
                        }
                        bitmap.recycle()
                        pages.add(mapOf("uri" to "file://${file.absolutePath}", "width" to width, "height" to height))
                    }
                }
            }
        }
        return pages
    }
}
