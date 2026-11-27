package expo.modules.vault

import android.content.Context
import android.os.Build
import android.os.storage.StorageManager
import expo.modules.kotlin.Promise
import java.io.File

internal class VaultBackupRunner(
    private val contextProvider: () -> Context,
    private val entries: VaultEntryStore,
    private val restoreCancel: RestoreCancel,
    private val emitProgress: (Map<String, Any>) -> Unit,
) {
    private val resourceMessage = "This device does not have enough memory to read this backup."

    /** Peak copies of a string entry in restore (with Keystore buffering headroom); never below 3. */
    private val stringEntryCopies = 4

    fun exportBackup(
        destPath: String,
        passphrase: String,
        extraFiles: List<Map<String, String>>,
        stagingDir: String,
        promise: Promise,
    ) {
        try {
            val staging = BackupContainer.StagingDirectory.resolve(stagingDir, contextProvider().cacheDir)
            val secretKey = entries.getSecretKey()
            val backupEntries = mutableListOf<BackupContainer.Entry>()
            for (file in entries.vaultEntryFiles()) {
                val kind = if (VaultCrypto.isChunked(file)) "f" else "s"
                val source = BackupContainer.Source.Staged { plain -> entries.decryptEntry(file, plain, secretKey) }
                backupEntries.add(BackupContainer.Entry(file.name, kind, source))
            }
            for (extra in extraFiles) {
                val key = extra["key"] ?: continue
                val path = extra["path"] ?: continue
                backupEntries.add(BackupContainer.Entry(key, "x", BackupContainer.Source.Ready(File(path))))
            }
            val result = BackupContainer.write(File(destPath), passphrase, staging, backupEntries) { done, total ->
                emitProgress(mapOf("phase" to "export", "done" to done, "total" to total))
            }
            promise.resolve(mapOf("entries" to result.first, "bytes" to result.second))
        } catch (e: BackupContainer.StagingException) {
            promise.reject("BACKUP_STAGING_INVALID", e.message, e)
        } catch (e: Exception) {
            promise.reject(VaultErrors.keyFailureCode(e, "BACKUP_EXPORT_FAILED"), e.message, e)
        }
    }

    fun inspectBackup(sourcePath: String, promise: Promise) {
        try {
            val header = BackupContainer.readHeader(File(sourcePath))
            promise.resolve(
                mapOf(
                    "version" to header.version,
                    "app" to header.app,
                    "created" to header.created,
                    "entries" to maxOf(0, header.entries - 1),
                ),
            )
        } catch (e: Throwable) {
            when (e) {
                is BackupContainer.UnsupportedException -> promise.reject("BACKUP_UNSUPPORTED", e.message, e)
                is BackupContainer.ResourceException -> promise.reject("BACKUP_RESOURCE", e.message, e)
                is OutOfMemoryError -> promise.reject("BACKUP_RESOURCE", resourceMessage, e)
                is Exception -> promise.reject("BACKUP_INVALID", e.message, e)
                else -> throw e
            }
        }
    }

    fun importBackup(
        sourcePath: String,
        passphrase: String,
        extraDir: String,
        stagingDir: String,
        runId: String,
        promise: Promise,
    ) {
        var cleared = false
        restoreCancel.start(runId)
        try {
            val staging = BackupContainer.StagingDirectory.resolve(
                stagingDir,
                contextProvider().cacheDir,
                BackupContainer.StagingDirectory.RESTORE_NAME,
            )
            val secretKey = entries.getSecretKey()
            val extras = File(extraDir).apply { mkdirs() }
            val restored = mutableListOf<Map<String, String>>()
            var count = 0
            BackupContainer.read(
                File(sourcePath),
                passphrase,
                staging,
                validate = { meta ->
                    if (!entries.isRestoreKeyAllowed(meta)) {
                        throw BackupContainer.CorruptException("entry key ${meta.key}")
                    }
                },
                validateAll = { metas ->
                    if (!entries.hasIndex(metas)) throw BackupContainer.CorruptException("no document index")
                },
                progress = { phase, done, total ->
                    emitProgress(mapOf("phase" to phase.wireName, "done" to done, "total" to total))
                },
                preflight = { layout ->
                    preflightRestore(layout)
                    entries.probeKey(secretKey)
                },
                cancelled = { restoreCancel.isRequested },
                commit = { restoreCancel.commit() },
            ) { meta, plain ->
                try {
                    if (!cleared) {
                        entries.probeKey(secretKey)
                        val previous = entries.vaultEntryFiles()
                        cleared = true
                        previous.forEach { VaultFiles.remove(it) }
                        entries.clearLegacyIvs()
                    }
                    when (meta.kind) {
                        "s" -> StringEntry.write(entries.vaultFile(meta.key), plain.readBytes(), secretKey)
                        "f" -> VaultCrypto.encryptFile(plain, entries.vaultFile(meta.key), secretKey)
                        "x" -> {
                            val target = entries.contained(File(extras, meta.key), extras)
                            target.delete()
                            if (!plain.renameTo(target)) {
                                plain.copyTo(target, overwrite = true)
                            }
                            restored.add(mapOf("key" to meta.key, "path" to target.absolutePath))
                        }
                    }
                    count += 1
                } finally {
                    plain.delete()
                }
            }
            promise.resolve(mapOf("entries" to count, "extras" to restored))
        } catch (e: Throwable) {
            if (e !is Exception && e !is OutOfMemoryError && !cleared) throw e
            val code = VaultErrors.keyFailureCode(e, "BACKUP_IMPORT_FAILED")
            val partial =
                "The restore stopped after the previous vault was removed: ${e.message ?: e.javaClass.simpleName}"
            when {
                VaultErrors.isKeyCode(code) -> promise.reject(code, if (cleared) partial else e.message, e)
                cleared -> promise.reject("BACKUP_PARTIAL", partial, e)
                e is OutOfMemoryError -> promise.reject("BACKUP_RESOURCE", resourceMessage, e)
                e is BackupContainer.CancelledException -> promise.reject("BACKUP_CANCELLED", e.message, e)
                e is BackupContainer.StagingException -> promise.reject("BACKUP_RESTORE_STAGING_INVALID", e.message, e)
                e is BackupContainer.PassphraseException -> promise.reject("BACKUP_PASSPHRASE", e.message, e)
                e is BackupContainer.UnsupportedException -> promise.reject("BACKUP_UNSUPPORTED", e.message, e)
                e is BackupContainer.ResourceException -> promise.reject("BACKUP_RESOURCE", e.message, e)
                e is BackupContainer.NoSpaceException -> promise.reject("BACKUP_NO_SPACE", e.message, e)
                e is BackupContainer.CorruptException -> promise.reject("BACKUP_INVALID", e.message, e)
                e is ExpoVaultModule.InvalidKeyException -> promise.reject("BACKUP_INVALID", e.message, e)
                else -> promise.reject(code, e.message, e)
            }
        } finally {
            restoreCancel.finish(runId)
        }
    }

    private fun preflightRestore(layout: List<BackupContainer.EntryInfo>) {
        val needs = BackupContainer.restoreNeeds(layout)
        BackupContainer.reserveMemory(needs.largestString, stringEntryCopies)
        val filesDir = contextProvider().filesDir
        val freed = entries.vaultEntryFiles().sumOf { it.length() }
        val free = writableBytes(filesDir)
        BackupContainer.checkSpace(needs.disk, needs.scratch, free, freed)
    }

    private fun writableBytes(directory: File): Long {
        val usable = directory.usableSpace
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return usable
        val context = contextProvider()
        val allocatable = try {
            val storage = context.getSystemService(StorageManager::class.java)
            storage?.getAllocatableBytes(storage.getUuidForPath(directory))
        } catch (e: Exception) {
            null
        }
        return BackupContainer.writableBytes(usable, allocatable, treeBytes(context.cacheDir))
    }

    private fun treeBytes(root: File): Long =
        root.walkTopDown()
            .onEnter { !java.nio.file.Files.isSymbolicLink(it.toPath()) }
            .filter { it.isFile && !java.nio.file.Files.isSymbolicLink(it.toPath()) }
            .sumOf { it.length() }
}
