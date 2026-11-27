package expo.modules.vault

import org.json.JSONObject
import java.io.EOFException
import java.io.File
import java.io.RandomAccessFile
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

internal object BackupFormat {
    val MAGIC = "SVB1".toByteArray(Charsets.US_ASCII)
    const val VERSION = 1
    const val ITERATIONS = 600_000
    const val CHECK_KEY = "_check"
    val CHECK_VALUE = "SecureVault backup check".toByteArray(Charsets.UTF_8)
    const val KDF_NAME = "pbkdf2-hmac-sha256"
    const val CIPHER = "aes-256-gcm"

    /**
     * Every iteration count a committed exporter has written (all of them write [ITERATIONS]).
     * A reader refuses anything else before the key derivation runs, so a crafted header cannot
     * make PBKDF2 run for hours. An exporter that changes the count must bump [VERSION].
     */
    val SUPPORTED_ITERATIONS = setOf(ITERATIONS)

    /** The kinds a version-1 exporter writes; anything else is refused in the pre-pass. */
    private val KINDS = setOf("c", "s", "f", "x")

    /** The check entry, the database key string and the index extra: the smallest backup the app writes. */
    private const val MIN_ENTRIES = 3

    /** The `SVC1` magic and chunk-size field that open every payload; a plaintext is at most the rest. */
    const val STREAM_HEADER_BYTES = 8L

    /** 2^63: a whole double below it in magnitude converts to a Long without clamping. */
    private const val LONG_LIMIT = 9.223372036854775807E18

    fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): SecretKey {
        val spec = PBEKeySpec(passphrase.toCharArray(), salt, iterations, 256)
        val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        return SecretKeySpec(bytes, "AES")
    }

    /**
     * Expects [input] at the start of the file. The header length is checked
     * against the bytes left in the file before it is allocated (an allocation
     * the device refuses is an OutOfMemoryError the module reports as
     * BACKUP_RESOURCE). Then, in the same order as on iOS: the version must be
     * an integer (above 1 is a newer format, below 1 a damaged header); every
     * field the exporter writes must be present with its JSON type and the
     * counts must fit their types (otherwise CorruptException); and the KDF
     * name, cipher and iteration count must be the ones a committed exporter
     * wrote (otherwise UnsupportedException). All of it runs before any key is
     * derived.
     */
    fun readHeader(input: RandomAccessFile): BackupContainer.Header {
        val magic = ByteArray(MAGIC.size)
        try {
            input.readFully(magic)
        } catch (e: Exception) {
            throw BackupContainer.CorruptException("not a SecureVault backup")
        }
        if (!magic.contentEquals(MAGIC)) throw BackupContainer.CorruptException("not a SecureVault backup")
        val headerBytes = try {
            val headerLength = input.readInt()
            if (headerLength < 0 || headerLength > input.length() - input.filePointer) {
                throw BackupContainer.CorruptException("truncated")
            }
            ByteArray(headerLength).also { input.readFully(it) }
        } catch (e: EOFException) {
            throw BackupContainer.CorruptException("truncated")
        }
        val json = try {
            JSONObject(String(headerBytes, Charsets.UTF_8))
        } catch (e: Exception) {
            throw BackupContainer.CorruptException("header")
        }
        val version = integral(json.opt("version")) ?: throw BackupContainer.CorruptException("header")
        if (version > VERSION) throw BackupContainer.UnsupportedException("format $version")
        if (version < VERSION) throw BackupContainer.CorruptException("header")
        val kdf = json.opt("kdf") as? JSONObject ?: throw BackupContainer.CorruptException("header")
        val kdfName = kdf.opt("name") as? String ?: throw BackupContainer.CorruptException("header")
        val cipher = json.opt("cipher") as? String ?: throw BackupContainer.CorruptException("header")
        val app = json.opt("app") as? String ?: throw BackupContainer.CorruptException("header")
        val created = json.opt("created") as? String ?: throw BackupContainer.CorruptException("header")
        val iterations = integral(kdf.opt("iterations")) ?: throw BackupContainer.CorruptException("header")
        if (iterations < 1 || iterations > Int.MAX_VALUE) throw BackupContainer.CorruptException("header")
        val entries = integral(json.opt("entries")) ?: throw BackupContainer.CorruptException("header")
        if (entries < MIN_ENTRIES || entries > Int.MAX_VALUE) throw BackupContainer.CorruptException("header")
        val encodedSalt = kdf.opt("salt") as? String ?: throw BackupContainer.CorruptException("salt")
        val salt = try {
            android.util.Base64.decode(encodedSalt, android.util.Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            throw BackupContainer.CorruptException("salt")
        }
        if (salt.isEmpty()) throw BackupContainer.CorruptException("salt")
        if (kdfName != KDF_NAME) throw BackupContainer.UnsupportedException("key derivation $kdfName")
        if (cipher != CIPHER) throw BackupContainer.UnsupportedException("cipher $cipher")
        if (iterations.toInt() !in SUPPORTED_ITERATIONS) {
            throw BackupContainer.UnsupportedException("$iterations iterations")
        }
        return BackupContainer.Header(
            version = version.toInt(),
            app = app,
            created = created,
            iterations = iterations.toInt(),
            salt = salt,
            entries = entries.toInt(),
        )
    }

    /**
     * The pre-pass: every entry's metadata and declared payload length, with the
     * structure every version-1 exporter writes enforced before any key is derived.
     * The first entry is the check entry and no other entry has its kind; every kind
     * is one the exporter writes; no two other entries share a key (they come from
     * one directory listing plus the index extra); and the file ends right after the
     * last declared entry. Anything else is a CorruptException.
     */
    fun readLayout(source: File): List<BackupContainer.EntryInfo> =
        RandomAccessFile(source, "r").use { input ->
            val header = readHeader(input)
            // The count is untrusted: grow the list as entries are read, so a
            // short file fails on its first missing byte instead of allocating.
            val layout = ArrayList<BackupContainer.EntryInfo>()
            val keys = HashSet<String>()
            repeat(header.entries) { index ->
                val (meta, size) = readEntryHead(input, index)
                if (meta.kind !in KINDS) throw BackupContainer.CorruptException("entry $index kind")
                if (index == 0) {
                    if (meta.kind != "c" || meta.key != CHECK_KEY) {
                        throw BackupContainer.CorruptException("check entry")
                    }
                } else {
                    if (meta.kind == "c") throw BackupContainer.CorruptException("entry $index kind")
                    if (!keys.add(meta.key)) throw BackupContainer.CorruptException("duplicate entry")
                }
                input.seek(input.filePointer + size)
                layout.add(BackupContainer.EntryInfo(meta, size))
            }
            if (input.filePointer != input.length()) throw BackupContainer.CorruptException("trailing data")
            layout
        }

    /**
     * Reads one entry's metadata and payload length, leaving [input] at the
     * payload. Both lengths are checked against the bytes left in the file.
     */
    fun readEntryHead(input: RandomAccessFile, index: Int): Pair<BackupContainer.Meta, Long> =
        try {
            val metaLength = input.readInt()
            if (metaLength < 0 || metaLength > input.length() - input.filePointer) {
                throw BackupContainer.CorruptException("truncated")
            }
            val metaBytes = ByteArray(metaLength)
            input.readFully(metaBytes)
            val meta = parseMeta(metaBytes, index)
            val size = input.readLong()
            if (size < 0 || size > input.length() - input.filePointer) {
                throw BackupContainer.CorruptException("truncated")
            }
            Pair(meta, size)
        } catch (e: EOFException) {
            throw BackupContainer.CorruptException("truncated")
        }

    /**
     * A JSON number read as an integer the way Swift's `JSONDecoder` reads one into `Int`, so both
     * platforms accept and refuse the same headers: `600000`, `600000.0` and `6e5` all count, a
     * fraction, a string or a boolean does not, and nor does a number outside a 64-bit integer.
     */
    private fun integral(value: Any?): Long? = when (value) {
        is Int, is Long, is Short, is Byte -> (value as Number).toLong()
        is java.math.BigInteger -> if (value.bitLength() < 64) value.toLong() else null
        is java.math.BigDecimal -> try {
            value.toBigIntegerExact().let { if (it.bitLength() < 64) it.toLong() else null }
        } catch (e: ArithmeticException) {
            null
        }
        is Double, is Float -> (value as Number).toDouble().let {
            if (it == Math.rint(it) && Math.abs(it) < LONG_LIMIT) it.toLong() else null
        }
        else -> null
    }

    /** Both fields must be JSON strings, as on iOS; `getString` would coerce numbers. */
    private fun parseMeta(bytes: ByteArray, index: Int): BackupContainer.Meta {
        val json = try {
            JSONObject(String(bytes, Charsets.UTF_8))
        } catch (e: Exception) {
            throw BackupContainer.CorruptException("entry $index")
        }
        val key = json.opt("key") as? String ?: throw BackupContainer.CorruptException("entry $index")
        val kind = json.opt("kind") as? String ?: throw BackupContainer.CorruptException("entry $index")
        return BackupContainer.Meta(key, kind)
    }
}
