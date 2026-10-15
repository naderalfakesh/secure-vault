package expo.modules.vault

import org.json.JSONObject
import java.io.DataOutputStream
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
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
        RandomAccessFile(source, "r").use { readHeader(it) }

    /**
     * Expects [input] at the start of the file. The header length is checked
     * against the bytes left in the file, and the entry count and iterations
     * must fit the types they are used as, before anything is allocated or
     * derived.
     */
    private fun readHeader(input: RandomAccessFile): Header {
        val magic = ByteArray(MAGIC.size)
        try {
            input.readFully(magic)
        } catch (e: Exception) {
            throw CorruptException("not a SecureVault backup")
        }
        if (!magic.contentEquals(MAGIC)) throw CorruptException("not a SecureVault backup")
        val headerBytes = try {
            val headerLength = input.readInt()
            if (headerLength < 0 || headerLength > input.length() - input.filePointer) throw CorruptException("truncated")
            ByteArray(headerLength).also { input.readFully(it) }
        } catch (e: EOFException) {
            throw CorruptException("truncated")
        }
        val json = try {
            JSONObject(String(headerBytes, Charsets.UTF_8))
        } catch (e: Exception) {
            throw CorruptException("header")
        }
        val version = json.optInt("version", 0)
        if (version > VERSION) throw UnsupportedException(version)
        val kdf = json.optJSONObject("kdf") ?: throw CorruptException("header")
        val iterations = kdf.optLong("iterations", ITERATIONS.toLong())
        if (iterations < 1 || iterations > Int.MAX_VALUE) throw CorruptException("header")
        val entries = json.optLong("entries", 0)
        if (entries < 0 || entries > Int.MAX_VALUE) throw CorruptException("header")
        val salt = try {
            android.util.Base64.decode(kdf.optString("salt", ""), android.util.Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            throw CorruptException("salt")
        }
        if (salt.isEmpty()) throw CorruptException("salt")
        return Header(
            version = version,
            app = json.optString("app", ""),
            created = json.optString("created", ""),
            iterations = iterations.toInt(),
            salt = salt,
            entries = entries.toInt(),
        )
    }

    /** Both fields must be JSON strings, as on iOS; `getString` would coerce numbers. */
    private fun parseMeta(bytes: ByteArray, index: Int): Meta {
        val json = try {
            JSONObject(String(bytes, Charsets.UTF_8))
        } catch (e: Exception) {
            throw CorruptException("entry $index")
        }
        val key = json.opt("key") as? String ?: throw CorruptException("entry $index")
        val kind = json.opt("kind") as? String ?: throw CorruptException("entry $index")
        return Meta(key, kind)
    }

    /**
     * Entry metadata only, read by seeking past each payload. No key is derived
     * and nothing is decrypted, so a bad key or a truncated file is found before
     * the vault is touched.
     */
    fun readMetas(source: File): List<Meta> =
        RandomAccessFile(source, "r").use { input ->
            val header = readHeader(input)
            // The count is untrusted: grow the list as entries are read, so a
            // short file fails on its first missing byte instead of allocating.
            val metas = ArrayList<Meta>()
            repeat(header.entries) { index ->
                val (meta, size) = readEntryHead(input, index)
                input.seek(input.filePointer + size)
                metas.add(meta)
            }
            metas
        }

    /**
     * Reads one entry's metadata and payload length, leaving [input] at the
     * payload. Both lengths are checked against the bytes left in the file.
     */
    private fun readEntryHead(input: RandomAccessFile, index: Int): Pair<Meta, Long> =
        try {
            val metaLength = input.readInt()
            if (metaLength < 0 || metaLength > input.length() - input.filePointer) throw CorruptException("truncated")
            val metaBytes = ByteArray(metaLength)
            input.readFully(metaBytes)
            val meta = parseMeta(metaBytes, index)
            val size = input.readLong()
            if (size < 0 || size > input.length() - input.filePointer) throw CorruptException("truncated")
            Pair(meta, size)
        } catch (e: EOFException) {
            throw CorruptException("truncated")
        }

    /** Which pass of a restore a progress event belongs to; [wireName] is the phase name sent to JavaScript. */
    enum class ReadPhase(val wireName: String) { VERIFY("verify"), RESTORE("import") }

    /**
     * Decrypts every entry in two passes. The first checks the passphrase
     * against the check entry, then decrypts every other payload to nothing,
     * so a backup that is damaged anywhere, including its last entry, is
     * refused before [handle] runs. The second decrypts again and hands each
     * plaintext file to [handle], which may move it; whatever [handle] leaves
     * behind is removed when it returns, even by throwing. The second pass is not a
     * transaction: once [handle] has started replacing the vault, a disk, I/O
     * or key failure still leaves it partly restored; the caller reports that
     * case separately.
     *
     * [validate] sees each entry's metadata on every pass; [validateAll] sees the
     * whole list once, after the pre-pass and before the key is derived, for rules
     * about which entries must be present.
     */
    fun read(
        source: File, passphrase: String, scratch: File, validate: (Meta) -> Unit,
        validateAll: (List<Meta>) -> Unit = {},
        progress: (ReadPhase, Int, Int) -> Unit, handle: (Meta, File) -> Unit
    ) {
        val metas = readMetas(source)
        metas.forEach(validate)
        validateAll(metas)
        val header = readHeader(source)
        val key = deriveKey(passphrase, header.salt, header.iterations)

        walk(source, scratch, validate, { done, total -> progress(ReadPhase.VERIFY, done, total) }) { meta, payload ->
            if (meta.kind == "c") {
                verifyCheck(payload, key, scratch)
            } else {
                try {
                    VaultCrypto.verifyFile(payload, key)
                } catch (e: Exception) {
                    throw CorruptException("entry ${meta.key}")
                }
            }
        }
        walk(source, scratch, validate, { done, total -> progress(ReadPhase.RESTORE, done, total) }) { meta, payload ->
            if (meta.kind == "c") {
                verifyCheck(payload, key, scratch)
                return@walk
            }
            val plain = temporaryFile(scratch)
            try {
                VaultCrypto.decryptFile(payload, plain, key, null)
            } catch (e: Exception) {
                plain.delete()
                throw CorruptException("entry ${meta.key}")
            }
            try {
                handle(meta, plain)
            } finally {
                plain.delete()
            }
        }
    }

    /** The check entry must decrypt to the fixed value; anything else means the passphrase is wrong. */
    private fun verifyCheck(payload: File, key: SecretKey, scratch: File) {
        val plain = temporaryFile(scratch)
        try {
            try {
                VaultCrypto.decryptFile(payload, plain, key, null)
            } catch (e: Exception) {
                throw PassphraseException()
            }
            if (!plain.readBytes().contentEquals(CHECK_VALUE)) throw PassphraseException()
        } finally {
            plain.delete()
        }
    }

    /**
     * One pass over the container: each entry's metadata is validated again,
     * its payload is copied to a temporary file that [visit] may read but not
     * keep, and progress is reported per entry.
     */
    private fun walk(
        source: File, scratch: File, validate: (Meta) -> Unit,
        progress: (Int, Int) -> Unit, visit: (Meta, File) -> Unit
    ) {
        RandomAccessFile(source, "r").use { input ->
            val header = readHeader(input)
            for (index in 0 until header.entries) {
                // Lengths and metadata are checked again in case the file changed since the pre-pass.
                val (meta, size) = readEntryHead(input, index)
                validate(meta)
                val payload = temporaryFile(scratch)
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
                    visit(meta, payload)
                } finally {
                    payload.delete()
                }
                progress(index + 1, header.entries)
            }
        }
    }
}
