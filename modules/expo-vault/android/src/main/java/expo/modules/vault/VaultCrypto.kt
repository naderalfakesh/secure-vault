package expo.modules.vault

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Streaming AES-256-GCM container shared with the iOS implementation.
 *
 * Layout: magic "SVC1", chunk size (Int32 BE), then per chunk an Int32 BE
 * length followed by nonce (12) + ciphertext + tag (16). The chunk index is
 * bound as additional authenticated data so chunks cannot be reordered or
 * dropped. Files written by the 2025 prototype have no header and keep their
 * IV in SharedPreferences; [legacyIv] handles those.
 */
object VaultCrypto {
    private val MAGIC = "SVC1".toByteArray(Charsets.US_ASCII)
    const val CHUNK_SIZE = 1_048_576
    private const val NONCE_SIZE = 12
    private const val TAG_BITS = 128

    fun encryptFile(source: File, destination: File, key: SecretKey) {
        FileInputStream(source).use { input ->
            DataOutputStream(FileOutputStream(destination).buffered()).use { output ->
                output.write(MAGIC)
                output.writeInt(CHUNK_SIZE)
                val buffer = ByteArray(CHUNK_SIZE)
                var index = 0
                while (true) {
                    val read = readFully(input, buffer)
                    if (read <= 0) break
                    // Keystore keys generate their own random IV per init.
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    cipher.init(Cipher.ENCRYPT_MODE, key)
                    cipher.updateAAD(be32(index))
                    val sealed = cipher.doFinal(buffer, 0, read)
                    val iv = cipher.iv
                    output.writeInt(iv.size + sealed.size)
                    output.write(iv)
                    output.write(sealed)
                    index += 1
                }
            }
        }
    }

    fun encryptBytes(bytes: ByteArray, destination: File, key: SecretKey) {
        val temp = File.createTempFile("vault", null, destination.parentFile)
        try {
            temp.writeBytes(bytes)
            encryptFile(temp, destination, key)
        } finally {
            temp.delete()
        }
    }

    /** Returns true when the file uses the chunked container. */
    fun isChunked(file: File): Boolean {
        if (file.length() < MAGIC.size) return false
        FileInputStream(file).use { input ->
            val header = ByteArray(MAGIC.size)
            val read = readFully(input, header)
            return read == MAGIC.size && header.contentEquals(MAGIC)
        }
    }

    fun decryptFile(source: File, destination: File, key: SecretKey, legacyIv: ByteArray?) {
        if (!isChunked(source)) {
            val iv = legacyIv ?: throw IllegalStateException("Legacy file without IV")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, iv))
            destination.parentFile?.mkdirs()
            destination.writeBytes(cipher.doFinal(source.readBytes()))
            return
        }
        destination.parentFile?.mkdirs()
        DataInputStream(FileInputStream(source).buffered()).use { input ->
            input.skipBytes(MAGIC.size)
            input.readInt() // chunk size, informational
            FileOutputStream(destination).buffered().use { output ->
                var index = 0
                while (input.available() > 0) {
                    val length = input.readInt()
                    val iv = ByteArray(NONCE_SIZE)
                    input.readFully(iv)
                    val sealed = ByteArray(length - NONCE_SIZE)
                    input.readFully(sealed)
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, iv))
                    cipher.updateAAD(be32(index))
                    output.write(cipher.doFinal(sealed))
                    index += 1
                }
            }
        }
    }

    /** Downsampled, orientation-corrected JPEG for list thumbnails. */
    fun thumbnailJpeg(source: File, maxPixelSize: Int): ByteArray {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.path, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxPixelSize || bounds.outHeight / (sample * 2) >= maxPixelSize) {
            sample *= 2
        }
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        val decoded = BitmapFactory.decodeFile(source.path, options)
            ?: throw IllegalStateException("Could not decode image")
        val scale = minOf(1f, maxPixelSize.toFloat() / maxOf(decoded.width, decoded.height))
        val rotation = when (ExifInterface(source.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val matrix = Matrix().apply {
            postScale(scale, scale)
            if (rotation != 0f) postRotate(rotation)
        }
        val bitmap = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
        val output = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, output)
        if (bitmap !== decoded) decoded.recycle()
        bitmap.recycle()
        return output.toByteArray()
    }

    private fun readFully(input: FileInputStream, buffer: ByteArray): Int {
        var total = 0
        while (total < buffer.size) {
            val read = input.read(buffer, total, buffer.size - total)
            if (read < 0) break
            total += read
        }
        return total
    }

    private fun be32(value: Int): ByteArray = ByteBuffer.allocate(4).putInt(value).array()
}
