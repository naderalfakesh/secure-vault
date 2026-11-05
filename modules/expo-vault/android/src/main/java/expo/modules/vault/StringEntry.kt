package expo.modules.vault

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * A string entry (the index key, the key probe): magic "SVS1", the 12-byte
 * nonce, then the AES-256-GCM ciphertext and tag.
 *
 * The nonce travels inside the file, and the file is replaced with a single
 * rename after its bytes are synced, so a write the process never finishes
 * leaves the previous entry or none, never a ciphertext whose nonce is
 * somewhere else. Entries written before this format keep their nonce in
 * SharedPreferences and are read with [legacyIv] until they are written again.
 */
internal object StringEntry {
    private val MAGIC = "SVS1".toByteArray(Charsets.US_ASCII)
    private const val NONCE_SIZE = 12
    private const val TAG_BITS = 128
    private const val TAG_BYTES = TAG_BITS / 8

    fun write(destination: File, plain: ByteArray, key: SecretKey) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val nonce = cipher.iv
        if (nonce.size != NONCE_SIZE) throw IllegalStateException("Unexpected GCM nonce size ${nonce.size}")
        val sealed = cipher.doFinal(plain)

        // A leading dot keeps the temporary file out of the vault entry grammar.
        val parent = destination.parentFile ?: throw IOException("No folder for ${destination.name}")
        val temp = File(parent, ".tmp-${destination.name}")
        try {
            FileOutputStream(temp).use { output ->
                output.write(MAGIC)
                output.write(nonce)
                output.write(sealed)
                output.fd.sync()
            }
            if (!temp.renameTo(destination)) throw IOException("Could not replace ${destination.name}")
        } finally {
            temp.delete()
        }
    }

    /** True when [bytes] is in this format; anything else is a legacy single GCM box. */
    fun isInline(bytes: ByteArray): Boolean =
        bytes.size >= MAGIC.size && bytes.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)

    fun read(source: File, key: SecretKey, legacyIv: ByteArray?): ByteArray {
        val bytes = source.readBytes()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        if (isInline(bytes)) {
            val bodyStart = MAGIC.size + NONCE_SIZE
            if (bytes.size < bodyStart + TAG_BYTES) throw VaultCrypto.CorruptException("string entry")
            val nonce = bytes.copyOfRange(MAGIC.size, bodyStart)
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, nonce))
            return cipher.doFinal(bytes, bodyStart, bytes.size - bodyStart)
        }
        val iv = legacyIv ?: throw IllegalStateException("Legacy entry without IV")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, iv))
        return cipher.doFinal(bytes)
    }
}
