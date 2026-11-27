package expo.modules.vault

import org.json.JSONObject
import java.io.DataOutputStream
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
    /** A header setting no committed exporter writes: a newer format, or KDF or cipher settings outside the verified set. */
    class UnsupportedException(reason: String) :
        Exception("This backup uses settings this version of the app does not support: $reason.")
    /** The device cannot hold what the restore needs in memory; raised before anything is removed. */
    class ResourceException(reason: String) :
        Exception("This device does not have enough memory to restore this backup: $reason.")
    /** The restore needs more disk than is free plus what the old vault frees; raised before anything is removed. */
    class NoSpaceException(val needed: Long, val available: Long) :
        Exception("This device does not have enough free space to restore this backup (needs $needed bytes, has $available).")
    class StagingException(reason: String) : Exception("The backup staging folder is not allowed: $reason")
    class RemovalException(reason: String) : Exception("The cache entry cannot be removed: $reason")
    /** The caller asked to stop while the restore was still checking; nothing was handled. */
    class CancelledException : Exception("The restore was cancelled before anything was changed.")

    /**
     * The one folder export plaintext may be staged in, `<cacheDir>/backup-staging`, or restore
     * plaintext, `<cacheDir>/restore-staging`. Only this type can be handed to [write], [read] and [sweep].
     */
    class StagingDirectory private constructor(val dir: File) {
        companion object {
            const val NAME = "backup-staging"
            const val RESTORE_NAME = "restore-staging"

            fun resolve(requested: String, cacheDir: File, name: String = NAME): StagingDirectory =
                StagingDirectory(BackupStaging.resolveDir(requested, cacheDir, name))
        }
    }

    data class Header(val version: Int, val app: String, val created: String, val iterations: Int, val salt: ByteArray, val entries: Int)
    data class Meta(val key: String, val kind: String)
    /** One entry as the pre-pass found it: its metadata and the payload length it declares. */
    data class EntryInfo(val meta: Meta, val payloadLength: Long)
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

    /** What the restore pass needs, worked out from the pre-pass before anything is removed. */
    data class RestoreNeeds(
        /** Upper bound of the largest `s` plaintext, which the restore pass holds in memory whole. */
        val largestString: Long,
        /** Bytes the restored vault, extras and the restore pass's temporary files can take at their peak. */
        val disk: Long,
        /**
         * Bytes the restore pass writes before the old vault is removed: the first restored entry's
         * payload copy and its plaintext, at most twice its payload. They need free space of their own.
         */
        val scratch: Long,
    )

    /** Which pass of a restore a progress event belongs to; [wireName] is the phase name sent to JavaScript. */
    enum class ReadPhase(val wireName: String) { VERIFY("verify"), RESTORE("import") }

    val SUPPORTED_ITERATIONS = BackupFormat.SUPPORTED_ITERATIONS

    fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): SecretKey =
        BackupFormat.deriveKey(passphrase, salt, iterations)

    fun temporaryFile(directory: File): File = File.createTempFile("backup", null, directory)

    fun sweep(staging: StagingDirectory) = BackupStaging.sweep(staging.dir)

    fun removeNoFollow(requested: String, roots: List<File>, exact: List<File> = emptyList()) =
        BackupStaging.removeNoFollow(requested, roots, exact)

    fun readHeader(source: File): Header =
        RandomAccessFile(source, "r").use { BackupFormat.readHeader(it) }

    fun readMetas(source: File): List<Meta> = readLayout(source).map { it.meta }

    fun readLayout(source: File): List<EntryInfo> = BackupFormat.readLayout(source)

    fun restoreNeeds(layout: List<EntryInfo>): RestoreNeeds = BackupPreflight.restoreNeeds(layout)

    fun reserveMemory(bytes: Long, copies: Int) = BackupPreflight.reserveMemory(bytes, copies)

    fun writableBytes(usable: Long, allocatable: Long?, ownCache: Long): Long =
        BackupPreflight.writableBytes(usable, allocatable, ownCache)

    fun checkSpace(needed: Long, scratch: Long, free: Long, freed: Long) =
        BackupPreflight.checkSpace(needed, scratch, free, freed)

    /**
     * Writes the container. Plaintext is staged one entry at a time inside [staging], which is swept
     * first (an earlier export may have been killed mid-entry) and left empty whether the write
     * succeeds or fails. Returns (entries, bytes).
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
        val key = deriveKey(passphrase, salt, BackupFormat.ITERATIONS)
        val created = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date())
        val header = JSONObject()
            .put("version", BackupFormat.VERSION)
            .put("app", "SecureVault")
            .put("created", created)
            .put(
                "kdf",
                JSONObject()
                    .put("name", BackupFormat.KDF_NAME)
                    .put("iterations", BackupFormat.ITERATIONS)
                    .put("salt", android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP)),
            )
            .put("cipher", BackupFormat.CIPHER)
            .put("entries", entries.size + 1)
            .toString().toByteArray(Charsets.UTF_8)

        val check = Entry(BackupFormat.CHECK_KEY, "c", Source.Staged { it.writeBytes(BackupFormat.CHECK_VALUE) })
        val all = listOf(check) + entries
        DataOutputStream(FileOutputStream(destination).buffered()).use { output ->
            output.write(BackupFormat.MAGIC)
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

    /** Decrypts every entry in two passes: verify everything first, then hand plaintext to [handle]. */
    fun read(
        source: File, passphrase: String, staging: StagingDirectory, validate: (Meta) -> Unit,
        validateAll: (List<Meta>) -> Unit = {},
        progress: (ReadPhase, Int, Int) -> Unit,
        preflight: (List<EntryInfo>) -> Unit = {},
        cancelled: () -> Boolean = { false },
        commit: () -> Boolean = { !cancelled() },
        handle: (Meta, File) -> Unit
    ) {
        sweep(staging)
        try {
            readEntries(source, passphrase, staging.dir, validate, validateAll, progress, preflight, cancelled, commit, handle)
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
        progress: (ReadPhase, Int, Int) -> Unit,
        preflight: (List<EntryInfo>) -> Unit,
        cancelled: () -> Boolean,
        commit: () -> Boolean,
        handle: (Meta, File) -> Unit
    ) {
        val stopIfCancelled = { if (cancelled()) throw CancelledException() }
        val layout = readLayout(source)
        val metas = layout.map { it.meta }
        metas.forEach(validate)
        validateAll(metas)
        val header = readHeader(source)
        val key = deriveKey(passphrase, header.salt, header.iterations)

        walk(source, scratch, validate, { done, total -> progress(ReadPhase.VERIFY, done, total) }, stopIfCancelled) { meta, payload ->
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
        stopIfCancelled()
        preflight(layout)
        // The last point a cancel is honoured: from here on [handle] may replace the vault.
        if (!commit()) throw CancelledException()
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
            if (!plain.readBytes().contentEquals(BackupFormat.CHECK_VALUE)) throw PassphraseException()
        } finally {
            plain.delete()
        }
    }

    private fun walk(
        source: File, scratch: File, validate: (Meta) -> Unit,
        progress: (Int, Int) -> Unit, beforeEntry: () -> Unit = {}, visit: (Meta, File) -> Unit
    ) {
        RandomAccessFile(source, "r").use { input ->
            val header = BackupFormat.readHeader(input)
            for (index in 0 until header.entries) {
                beforeEntry()
                // Lengths and metadata are checked again in case the file changed since the pre-pass.
                val (meta, size) = BackupFormat.readEntryHead(input, index)
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
