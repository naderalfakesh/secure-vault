package expo.modules.vault

import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.KeyStore

class ExpoVaultModule : Module() {
    class InvalidKeyException(key: String) : IllegalArgumentException("Invalid vault key: $key")

    private val keyAlias = "encryptionKey"
    private val keystoreProvider = "AndroidKeyStore"

    /** Folder in `filesDir` the picked backup is moved into, so low storage cannot purge it. */
    private val restoreSourceName = "restore-source"

    private val restoreCancel = RestoreCancel()
    private val shareExpiry = ShareExpiryController()
    private val biometrics = VaultBiometrics(keyAlias, keystoreProvider)
    private val entries = VaultEntryStore({ appContext.reactContext!! }, keyAlias, keystoreProvider)
    private val backups = VaultBackupRunner(
        contextProvider = { appContext.reactContext!! },
        entries = entries,
        restoreCancel = restoreCancel,
        emitProgress = { payload -> sendEvent("backupProgress", payload) },
    )

    override fun definition() = ModuleDefinition {
        Name("ExpoVault")

        Events("backupProgress")

        OnCreate {
            shareExpiry.attach(appContext.reactContext)
        }

        OnDestroy {
            shareExpiry.detach()
        }

        // When an activity of the app was last stopped, in epoch milliseconds; 0 before any.
        Function("lastStoppedAt") { shareExpiry.lastStoppedAt.toDouble() }

        // iOS drops its session's authenticated context here; Android's Keystore uses a timeout window.
        Function("endKeySession") { }

        AsyncFunction("createVault") { promise: Promise ->
            biometrics.createVault(appContext.reactContext, promise)
        }

        AsyncFunction("hasVault") { promise: Promise ->
            try {
                val keyStore = KeyStore.getInstance(keystoreProvider)
                keyStore.load(null)
                promise.resolve(keyStore.containsAlias(keyAlias))
            } catch (e: Exception) {
                promise.reject("HAS_VAULT_FAILED", e.message, e)
            }
        }

        // "trusted-environment", "strongbox", "software", or "none" before a vault exists.
        AsyncFunction("keyProtection") { promise: Promise ->
            try {
                val keyStore = KeyStore.getInstance(keystoreProvider)
                keyStore.load(null)
                promise.resolve(KeyProtection.of(keyStore, keyAlias))
            } catch (e: Exception) {
                promise.reject("KEY_PROTECTION_FAILED", e.message, e)
            }
        }

        AsyncFunction("biometryType") { promise: Promise ->
            biometrics.biometryType(appContext.reactContext, promise)
        }

        AsyncFunction("unlockWithBiometrics") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity as? FragmentActivity
            biometrics.unlockWithBiometrics(activity, promise)
        }

        AsyncFunction("put") { key: String, value: String, promise: Promise ->
            try {
                val file = entries.vaultFile(key)
                StringEntry.write(file, value.toByteArray(), entries.getSecretKey())
                // The nonce is in the file now; a legacy one left behind is never read.
                entries.removeLegacyIv(key, synchronous = true)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "PUT_FAILED"), e.message, e)
            }
        }

        AsyncFunction("get") { key: String, promise: Promise ->
            try {
                val secretKey = entries.getSecretKey()
                val file = entries.vaultFile(key)
                if (!file.exists()) {
                    promise.reject("GET_FAILED", "File not found for key: $key", null)
                    return@AsyncFunction
                }
                val decryptedData = StringEntry.read(file, secretKey, entries.legacyIv(key))
                promise.resolve(String(decryptedData))
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "GET_FAILED"), e.message, e)
            }
        }

        // Passphrase-protected backups (see VaultBackupRunner.kt & BackupContainer.kt)

        AsyncFunction("exportBackup") { destPath: String, passphrase: String, extraFiles: List<Map<String, String>>, stagingDir: String, promise: Promise ->
            backups.exportBackup(destPath, passphrase, extraFiles, stagingDir, promise)
        }

        AsyncFunction("inspectBackup") { sourcePath: String, promise: Promise ->
            backups.inspectBackup(sourcePath, promise)
        }

        Function("cancelRestore") { runId: String ->
            restoreCancel.request(runId)
        }

        AsyncFunction("importBackup") { sourcePath: String, passphrase: String, extraDir: String, stagingDir: String, runId: String, promise: Promise ->
            backups.importBackup(sourcePath, passphrase, extraDir, stagingDir, runId, promise)
        }

        AsyncFunction("getAllKeys") { promise: Promise ->
            try {
                promise.resolve(entries.vaultEntryFiles().map { it.name })
            } catch (e: Exception) {
                promise.reject("GET_ALL_KEYS_FAILED", e.message, e)
            }
        }

        AsyncFunction("delete") { key: String, promise: Promise ->
            try {
                // The stored nonce goes only once the entry is gone: a kept entry still needs it.
                VaultFiles.remove(entries.vaultFile(key))
                entries.removeLegacyIv(key)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DELETE_FAILED", e.message, e)
            }
        }

        // File-based encryption methods for binary data (images, PDFs, etc.)

        AsyncFunction("putFile") { key: String, sourcePath: String, promise: Promise ->
            try {
                val sourceFile = File(sourcePath)
                if (!sourceFile.exists()) {
                    promise.reject("PUT_FILE_FAILED", "Source file not found: $sourcePath", null)
                    return@AsyncFunction
                }
                VaultCrypto.encryptFile(sourceFile, entries.vaultFile(key), entries.getSecretKey())
                // Chunked files carry their own nonces; drop any legacy IV for this key.
                entries.removeLegacyIv(key)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "PUT_FILE_FAILED"), "Failed to encrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("putThumbnail") { key: String, sourcePath: String, maxPixelSize: Int, promise: Promise ->
            try {
                val jpeg = VaultCrypto.thumbnailJpeg(File(sourcePath), maxPixelSize)
                VaultCrypto.encryptBytes(jpeg, entries.vaultFile(key), entries.getSecretKey())
                entries.removeLegacyIv(key)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "PUT_THUMBNAIL_FAILED"), "Failed to create thumbnail: ${e.message}", e)
            }
        }

        AsyncFunction("renderPdfPages") { sourcePath: String, maxPixelSize: Int, destDir: String, promise: Promise ->
            try {
                promise.resolve(PdfPages.render(File(sourcePath), maxPixelSize, File(destDir)))
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "RENDER_PDF_FAILED"), "Failed to render the PDF: ${e.message}", e)
            }
        }

        AsyncFunction("getFile") { key: String, destPath: String, promise: Promise ->
            try {
                val encryptedFile = entries.vaultFile(key)
                if (!encryptedFile.exists()) {
                    promise.reject("GET_FILE_FAILED", "Encrypted file not found for key: $key", null)
                    return@AsyncFunction
                }
                VaultCrypto.decryptFile(encryptedFile, File(destPath), entries.getSecretKey(), entries.legacyIv(key))
                promise.resolve(destPath)
            } catch (e: Exception) {
                promise.reject(VaultErrors.keyFailureCode(e, "GET_FILE_FAILED"), "Failed to decrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("deleteFile") { key: String, promise: Promise ->
            try {
                VaultFiles.remove(entries.vaultFile(key))
                entries.removeLegacyIv(key)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DELETE_FILE_FAILED", "Failed to delete file: ${e.message}", e)
            }
        }

        // The share chooser is an activity of its own; the app cannot close it.
        AsyncFunction("dismissShareSheet") { false }

        Function("clipboardStamp") { shareExpiry.clipboardStamp(appContext.reactContext) }

        Function("scheduleShareExpiry") { path: String, delayMs: Double ->
            shareExpiry.schedule(appContext.reactContext!!.cacheDir, path, delayMs)
        }

        Function("cancelShareExpiry") { path: String ->
            shareExpiry.cancel(path)
        }

        // Android's backup rules exclude filesDir already.
        Function("excludeFromBackup") { _: String -> }

        Function("removeTreeNoFollow") { path: String ->
            val context = appContext.reactContext!!
            BackupContainer.removeNoFollow(
                path,
                listOf(context.cacheDir),
                listOf(File(context.filesDir, restoreSourceName)),
            )
        }

        AsyncFunction("getFileSize") { key: String, promise: Promise ->
            try {
                val file = entries.vaultFile(key)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "File not found for key: $key", null)
                    return@AsyncFunction
                }
                promise.resolve(file.length().toDouble())
            } catch (e: Exception) {
                promise.reject("GET_FILE_SIZE_FAILED", e.message, e)
            }
        }
    }
}
