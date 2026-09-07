package expo.modules.vault

import org.json.JSONObject
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Passphrase-protected backup container, identical on iOS and Android:
 *
 *   "SVB1" | be32 headerLength | header JSON
 *   then, per entry: be32 metaLength | meta JSON | be64 payloadLength | payload
 *
 * The payload is the vault's own chunked AES-256-GCM stream, keyed with a key
 * derived from the passphrase (PBKDF2-HMAC-SHA256). The first entry is a fixed
 * check value so a wrong passphrase is rejected before anything is touched.
 * Entry kinds: "s" string, "f" vault file, "x" extra file returned to the
 * caller (the SQLite index), "c" the check.
 */
object BackupContainer {
    class CorruptException(reason: String) : Exception("The backup file is not valid: $reason")
    class PassphraseException : Exception("That passphrase does not match this backup.")
    class UnsupportedException(version: Int) :
        Exception("This backup needs a newer version of the app (format $version).")

    data class Header(val version: Int, val app: String, val created: String, val iterations: Int, val salt: ByteArray, val entries: Int)
    data class Meta(val key: String, val kind: String)
    data class Entry(val key: String, val kind: String, val file: File)

    private val MAGIC = "SVB1".toByteArray(Charsets.US_ASCII)
    private const val VERSION = 1
    private const val ITERATIONS = 600_000
    private const val CHECK_KEY = "_check"
    private val CHECK_VALUE = "SecureVault backup check".toByteArray(Charsets.UTF_8)

    fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): SecretKey {
        val spec = PBEKeySpec(passphrase.toCharArray(), salt, iterations, 256)
        val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        return SecretKeySpec(bytes, "AES")
    }

    fun temporaryFile(directory: File): File = File.createTempFile("backup", null, directory)

    /** Writes the container from plaintext entries. Returns (entries, bytes). */
    fun write(destination: File, passphrase: String, entries: List<Entry>, progress: (Int, Int) -> Unit): Pair<Int, Long> {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val key = deriveKey(passphrase, salt, ITERATIONS)
        val created = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date())
        val header = JSONObject()
            .put("version", VERSION)
            .put("app", "SecureVault")
            .put("created", created)
            .put("kdf", JSONObject().put("name", "pbkdf2-hmac-sha256").put("iterations", ITERATIONS)
                .put("salt", android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP)))
            .put("cipher", "aes-256-gcm")
            .put("entries", entries.size + 1)
            .toString().toByteArray(Charsets.UTF_8)

        val check = temporaryFile(destination.parentFile ?: File("."))
        try {
            check.writeBytes(CHECK_VALUE)
            val all = listOf(Entry(CHECK_KEY, "c", check)) + entries
            DataOutputStream(FileOutputStream(destination).buffered()).use { output ->
                output.write(MAGIC)
                output.writeInt(header.size)
                output.write(header)
                all.forEachIndexed { index, entry ->
                    val payload = temporaryFile(destination.parentFile ?: File("."))
                    try {
                        VaultCrypto.encryptFile(entry.file, payload, key)
                        val meta = JSONObject().put("key", entry.key).put("kind", entry.kind)
                            .toString().toByteArray(Charsets.UTF_8)
                        output.writeInt(meta.size)
                        output.write(meta)
                        output.writeLong(payload.length())
                        FileInputStream(payload).use { it.copyTo(output) }
                    } finally {
                        payload.delete()
                    }
                    progress(index + 1, all.size)
                }
            }
        } finally {
            check.delete()
        }
        return Pair(entries.size, destination.length())
    }

    fun readHeader(source: File): Header =
        DataInputStream(FileInputStream(source).buffered()).use { readHeader(it) }

    private fun readHeader(input: DataInputStream): Header {
        val magic = ByteArray(MAGIC.size)
        try {
            input.readFully(magic)
        } catch (e: Exception) {
            throw CorruptException("not a SecureVault backup")
        }
        if (!magic.contentEquals(MAGIC)) throw CorruptException("not a SecureVault backup")
        val headerBytes = ByteArray(input.readInt())
        input.readFully(headerBytes)
        val json = try {
            JSONObject(String(headerBytes, Charsets.UTF_8))
        } catch (e: Exception) {
            throw CorruptException("header")
        }
        val version = json.optInt("version", 0)
        if (version > VERSION) throw UnsupportedException(version)
        val kdf = json.optJSONObject("kdf") ?: throw CorruptException("header")
        return Header(
            version = version,
            app = json.optString("app", ""),
            created = json.optString("created", ""),
            iterations = kdf.optInt("iterations", ITERATIONS),
            salt = android.util.Base64.decode(kdf.optString("salt", ""), android.util.Base64.DEFAULT),
            entries = json.optInt("entries", 0),
        )
    }

    /**
     * Streams every entry as a decrypted plaintext file. The check entry is
     * verified first; `handle` receives the others and owns the plaintext file.
     */
    fun read(source: File, passphrase: String, scratch: File, progress: (Int, Int) -> Unit, handle: (Meta, File) -> Unit) {
        DataInputStream(FileInputStream(source).buffered()).use { input ->
            val header = readHeader(input)
            val key = deriveKey(passphrase, header.salt, header.iterations)
            for (index in 0 until header.entries) {
                val metaBytes = ByteArray(input.readInt())
                input.readFully(metaBytes)
                val metaJson = JSONObject(String(metaBytes, Charsets.UTF_8))
                val meta = Meta(metaJson.getString("key"), metaJson.getString("kind"))
                val size = input.readLong()
                val payload = temporaryFile(scratch)
                val plain = temporaryFile(scratch)
                try {
                    FileOutputStream(payload).buffered().use { output ->
                        val buffer = ByteArray(1_048_576)
                        var remaining = size
                        while (remaining > 0) {
                            val read = input.read(buffer, 0, minOf(remaining, buffer.size.toLong()).toInt())
                            if (read <= 0) throw CorruptException("truncated")
                            output.write(buffer, 0, read)
                            remaining -= read
                        }
                    }
                    try {
                        VaultCrypto.decryptFile(payload, plain, key, null)
                    } catch (e: Exception) {
                        if (meta.kind == "c") throw PassphraseException()
                        throw CorruptException("entry ${meta.key}")
                    }
                    if (meta.kind == "c") {
                        if (!plain.readBytes().contentEquals(CHECK_VALUE)) throw PassphraseException()
                    } else {
                        handle(meta, plain)
                    }
                } finally {
                    payload.delete()
                    if (meta.kind == "c") plain.delete()
                }
                progress(index + 1, header.entries)
            }
        }
    }
}
