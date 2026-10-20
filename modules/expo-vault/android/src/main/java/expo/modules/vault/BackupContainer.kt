package expo.modules.vault

import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
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
import java.util.UUID
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
    class StagingException(reason: String) : Exception("The backup staging folder is not allowed: $reason")
    class RemovalException(reason: String) : Exception("The cache entry cannot be removed: $reason")

    /**
     * The one folder export plaintext may be staged in, `<cacheDir>/backup-staging`, or restore
     * plaintext, `<cacheDir>/restore-staging`. The requested path is canonicalised (symlinks and
     * `..` resolved) and compared exactly with the app's own cache location, so a sweep can never
     * reach the cache root, the vault, or whatever a planted link points at. Only this type can be
     * handed to [write], [read] and [sweep].
     */
    class StagingDirectory private constructor(val dir: File) {
        companion object {
            const val NAME = "backup-staging"
            const val RESTORE_NAME = "restore-staging"

            fun resolve(requested: String, cacheDir: File, name: String = NAME): StagingDirectory {
                if (!requested.startsWith("/")) throw StagingException("not an absolute path")
                val candidate = File(requested)
                // A link at the path is refused even when it points at the right place; a missing
                // folder is fine (the sweep creates it), anything else there is not.
                when (entryKind(candidate)) {
                    EntryKind.DIRECTORY, EntryKind.MISSING -> Unit
                    EntryKind.LINK, EntryKind.OTHER -> throw StagingException("not a directory")
                }
                val expected = File(cacheDir.canonicalFile, name)
                if (candidate.canonicalPath != expected.path) {
                    throw StagingException("not the app's $name cache folder")
                }
                return StagingDirectory(expected)
            }
        }
    }

    data class Header(val version: Int, val app: String, val created: String, val iterations: Int, val salt: ByteArray, val entries: Int)
    data class Meta(val key: String, val kind: String)
    data class Entry(val key: String, val kind: String, val source: Source)

    /** Where an entry's plaintext comes from while the container is written. */
    sealed class Source {
        /** A file that is safe to leave where it is: the caller's extra files, which their owner already encrypts (the SQLCipher index). */
        data class Ready(val file: File) : Source()

        /**
         * Plaintext produced on demand into a file inside the staging directory. [write] removes it as
         * soon as the entry is encrypted, so at most one entry is in plaintext at any time.
         */
        class Staged(val produce: (File) -> Unit) : Source()
    }

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

    /** What sits at a path, without following a link at the path itself. */
    private enum class EntryKind { MISSING, DIRECTORY, LINK, OTHER }

    /**
     * lstat-based, so a symbolic link is reported as a link and never as what it points at.
     * `android.system.Os` has been available since API 21; `java.nio.file` needs API 26, above the
     * app's minimum. Any error other than "no such entry" is reported as OTHER so the caller refuses it.
     */
    private fun entryKind(file: File): EntryKind {
        val mode = try {
            Os.lstat(file.path).st_mode
        } catch (e: ErrnoException) {
            return if (e.errno == OsConstants.ENOENT) EntryKind.MISSING else EntryKind.OTHER
        }
        return when {
            OsConstants.S_ISLNK(mode) -> EntryKind.LINK
            OsConstants.S_ISDIR(mode) -> EntryKind.DIRECTORY
            else -> EntryKind.OTHER
        }
    }

    /**
     * Empties the staging directory, creating it if needed. Backup and restore plaintext only ever lives there,
     * so one sweep is the whole cleanup after a crash. Throws when the folder cannot be created or
     * something in it could not be removed: staging must not start next to leftover plaintext.
     */
    fun sweep(staging: StagingDirectory) {
        val dir = staging.dir
        when (entryKind(dir)) {
            EntryKind.DIRECTORY -> Unit
            EntryKind.MISSING -> if (!dir.mkdirs()) throw StagingException("cannot be created")
            EntryKind.LINK, EntryKind.OTHER -> throw StagingException("cannot be created")
        }
        // A folder that cannot be listed may still hold plaintext, so it fails like one that cannot be emptied.
        val children = dir.listFiles() ?: throw StagingException("could not be emptied")
        var emptied = true
        children.forEach { if (!removeTree(it)) emptied = false }
        if (!emptied) throw StagingException("could not be emptied")
    }

    /**
     * Deletes a tree without following symbolic links, so a link planted in staging cannot pull in
     * its target: only a real directory is recursed into, and `File.delete` unlinks a link entry
     * itself. Returns false if anything is still there afterwards.
     */
    private fun removeTree(file: File): Boolean {
        var removed = true
        if (entryKind(file) == EntryKind.DIRECTORY) file.listFiles()?.forEach { if (!removeTree(it)) removed = false }
        return (file.delete() || entryKind(file) == EntryKind.MISSING) && removed
    }

    /**
     * Removes [requested] for the app's cache sweeps without following symbolic links (see
     * [removeTree]). Its parent is canonicalised and must lie inside one of [roots], so neither
     * `..` nor a linked ancestor can carry the removal out of them. A missing entry is fine.
     */
    fun removeNoFollow(requested: String, roots: List<File>) {
        if (!requested.startsWith("/")) throw RemovalException("not an absolute path")
        val file = File(requested)
        val name = file.name
        val parent = file.parentFile ?: throw RemovalException("not inside the app's cache")
        if (name.isEmpty() || name == "." || name == "..") throw RemovalException("not a single name")
        val canonicalParent = parent.canonicalFile
        val inside = roots.any { root ->
            val base = root.canonicalPath
            canonicalParent.path == base || canonicalParent.path.startsWith("$base/")
        }
        if (!inside) throw RemovalException("not inside the app's cache")
        if (!removeTree(File(canonicalParent, name))) throw RemovalException("could not be removed")
    }

    /**
     * Writes the container. Plaintext is staged one entry at a time inside [staging], which is swept
     * first (an earlier export may have been killed mid-entry) and left empty whether the write
     * succeeds or fails. Returns (entries, bytes).
     *
     * When the write fails, the cleanup sweep is best effort: the write's own error is what the
     * caller sees (it may be a locked-key failure the bridge maps to its own code) and a cleanup
     * error is attached as suppressed. After a successful write, a cleanup error fails the export,
     * because a success must not be reported while plaintext may still be on disk.
     */
    fun write(destination: File, passphrase: String, staging: StagingDirectory, entries: List<Entry>, progress: (Int, Int) -> Unit): Pair<Int, Long> {
        sweep(staging)
        val result = try {
            writeEntries(destination, passphrase, staging.dir, entries, progress)
        } catch (failure: Throwable) {
            try {
                sweep(staging)
            } catch (cleanup: Exception) {
                failure.addSuppressed(cleanup)
            }
            throw failure
        }
        sweep(staging)
        return result
    }

    private fun writeEntries(destination: File, passphrase: String, staging: File, entries: List<Entry>, progress: (Int, Int) -> Unit): Pair<Int, Long> {
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

        val check = Entry(CHECK_KEY, "c", Source.Staged { it.writeBytes(CHECK_VALUE) })
        val all = listOf(check) + entries
        DataOutputStream(FileOutputStream(destination).buffered()).use { output ->
            output.write(MAGIC)
            output.writeInt(header.size)
            output.write(header)
            all.forEachIndexed { index, entry ->
                val plain = File(staging, "plain-${UUID.randomUUID()}")
                val payload = File(staging, "payload-${UUID.randomUUID()}")
                try {
                    val source = when (val entrySource = entry.source) {
                        is Source.Ready -> entrySource.file
                        is Source.Staged -> plain.also(entrySource.produce)
                    }
                    VaultCrypto.encryptFile(source, payload, key)
                    // The plaintext has been consumed; drop it before the payload is copied out.
                    plain.delete()
                    val meta = JSONObject().put("key", entry.key).put("kind", entry.kind)
                        .toString().toByteArray(Charsets.UTF_8)
                    output.writeInt(meta.size)
                    output.write(meta)
                    output.writeLong(payload.length())
                    FileInputStream(payload).use { it.copyTo(output) }
                } finally {
                    plain.delete()
                    payload.delete()
                }
                progress(index + 1, all.size)
            }
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
     *
     * Every payload copy and plaintext lives in [staging], which is swept before anything is read
     * (a [StagingException] is thrown with the vault untouched) and again, best effort, when the
     * read ends either way.
     */
    fun read(
        source: File, passphrase: String, staging: StagingDirectory, validate: (Meta) -> Unit,
        validateAll: (List<Meta>) -> Unit = {},
        progress: (ReadPhase, Int, Int) -> Unit, handle: (Meta, File) -> Unit
    ) {
        sweep(staging)
        try {
            readEntries(source, passphrase, staging.dir, validate, validateAll, progress, handle)
        } finally {
            try {
                sweep(staging)
            } catch (cleanup: Exception) {
                // Each entry's files are already removed; the app's lock and launch sweep retries the folder.
            }
        }
    }

    private fun readEntries(
        source: File, passphrase: String, scratch: File, validate: (Meta) -> Unit,
        validateAll: (List<Meta>) -> Unit,
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
