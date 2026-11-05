package expo.modules.vault

import android.app.Activity
import android.app.Application
import android.content.ClipboardManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.storage.StorageManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

class ExpoVaultModule : Module() {
    class InvalidKeyException(key: String) : IllegalArgumentException("Invalid vault key: $key")

    private val keyAlias = "encryptionKey"
    private val RESOURCE_MESSAGE = "This device does not have enough memory to read this backup."
    /**
     * Copies of an `s` plaintext the restore pass holds at once: `readBytes`, the Keystore
     * cipher's growing output buffer (up to twice the result while it doubles) and the result
     * array. On the host JVM the same calls needed 3.3 times a 24 MiB plaintext of heap
     * (docs/verification/polish-round2.md); the Keystore's own buffering on a device is not
     * measured, so the fourth copy stays as its headroom. Never below 3.
     */
    private val STRING_ENTRY_COPIES = 4
    private val AUTH_VALIDITY_SECONDS = 300
    /** Folder in `filesDir` the picked backup is moved into, so low storage cannot purge it. */
    private val RESTORE_SOURCE_NAME = "restore-source"
    private val keystoreProvider = "AndroidKeyStore"
    // Callers of the prompt that is currently open, settled together from its
    // callback. Touched on the main thread only (runOnUiThread and the main executor).
    private val promptWaiters = mutableListOf<Promise>()
    // The share copy folder due for deletion and its pending deletion. The main
    // looper keeps running while the share chooser pauses the activity, which
    // stops JavaScript timers.
    private val mainHandler = Handler(Looper.getMainLooper())
    private var shareExpiry: Pair<String, Runnable>? = null
    // The cancel request of the running restore, tied to its run id (see [RestoreCancel]), so a
    // cancel that lands after one restore ended can never stop the next one.
    private val restoreCancel = RestoreCancel()
    // Wall-clock time an activity of the app was last stopped (Home, Recents, another app
    // opened over it), 0 before any. The share chooser is translucent, so it leaves the
    // activity paused, never stopped: a stop while a share pause runs means the user left.
    @Volatile private var lastStoppedAt = 0L
    private val stopWatcher = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityStopped(activity: Activity) {
            if (!activity.isChangingConfigurations) lastStoppedAt = System.currentTimeMillis()
        }
        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityResumed(activity: Activity) {}
        override fun onActivityPaused(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {}
    }
    private var watchedApplication: Application? = null
    private val ivPreferences: SharedPreferences by lazy {
        appContext.reactContext!!.getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoVault")

        Events("backupProgress")

        OnCreate {
            val application = appContext.reactContext?.applicationContext as? Application
            application?.registerActivityLifecycleCallbacks(stopWatcher)
            watchedApplication = application
        }

        OnDestroy {
            watchedApplication?.unregisterActivityLifecycleCallbacks(stopWatcher)
            watchedApplication = null
        }

        // When an activity of the app was last stopped, in epoch milliseconds; 0 before any.
        Function("lastStoppedAt") { lastStoppedAt.toDouble() }

        // iOS drops its session's authenticated context here. The Keystore key
        // is bounded by its own authentication window, so there is nothing to end.
        Function("endKeySession") { }

        AsyncFunction("createVault") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.reject("NO_CONTEXT", "Application context not available", null)
                    return@AsyncFunction
                }

                val biometricManager = BiometricManager.from(context)
                when (biometricManager.canAuthenticate(promptAuthenticators())) {
                    BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                    BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                    BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                        promise.reject("NO_AUTH_ENROLLED", "Please set up screen lock (PIN, pattern, or biometrics) in your device settings first", null)
                        return@AsyncFunction
                    }
                }

                val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, keystoreProvider)
                val parameterSpecBuilder = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setUserAuthenticationRequired(true)

                // A timeout-based key: any successful biometric or device-credential
                // prompt unlocks it for the window below. Per-use keys (timeout 0)
                // would need a CryptoObject on every cipher call, which this module
                // does not do (ADR 0003).
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    parameterSpecBuilder.setUserAuthenticationParameters(
                        AUTH_VALIDITY_SECONDS,
                        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                    )
                } else {
                    @Suppress("DEPRECATION")
                    parameterSpecBuilder.setUserAuthenticationValidityDurationSeconds(AUTH_VALIDITY_SECONDS)
                }

                val parameterSpec = parameterSpecBuilder.build()

                keyGenerator.init(parameterSpec)
                keyGenerator.generateKey()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("KEY_CREATION_FAILED", "Failed to create vault: ${e.message}", e)
            }
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

        AsyncFunction("biometryType") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.resolve("none")
                return@AsyncFunction
            }
            val available = BiometricManager.from(context)
                .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
            // Android does not expose which biometric is enrolled; "biometrics" keeps the copy honest.
            promise.resolve(if (available) "biometrics" else "none")
        }

        AsyncFunction("unlockWithBiometrics") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity as? FragmentActivity
            if (activity == null) {
                promise.reject("ACTIVITY_NOT_FOUND", "Unable to show biometric prompt. Please try again.", null)
                return@AsyncFunction
            }

            activity.runOnUiThread {
                // Once the activity has saved its state, androidx refuses to show the
                // prompt without calling back, which would leave this promise pending.
                if (activity.isFinishing || activity.isDestroyed || activity.supportFragmentManager.isStateSaved) {
                    promise.resolve(false)
                    return@runOnUiThread
                }
                // androidx keeps one prompt callback per activity: building a second
                // BiometricPrompt while one is showing hands that prompt's answer to the
                // new callback and the first caller never hears back. A caller arriving
                // while a prompt is open waits for its outcome instead.
                if (promptWaiters.isNotEmpty()) {
                    promptWaiters.add(promise)
                    return@runOnUiThread
                }
                promptWaiters.add(promise)
                try {
                    val executor = ContextCompat.getMainExecutor(activity)
                    val biometricPrompt = BiometricPrompt(activity, executor,
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                super.onAuthenticationSucceeded(result)
                                settlePrompt { it.resolve(true) }
                            }

                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                super.onAuthenticationError(errorCode, errString)
                                when (errorCode) {
                                    // Dismissing the prompt is a choice, not a failure: the
                                    // caller falls back to the PIN without showing an error.
                                    BiometricPrompt.ERROR_USER_CANCELED,
                                    BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                                    BiometricPrompt.ERROR_CANCELED -> settlePrompt { it.resolve(false) }
                                    else -> settlePrompt { it.reject("BIOMETRIC_AUTH_FAILED", errString.toString(), null) }
                                }
                            }

                            override fun onAuthenticationFailed() {
                                super.onAuthenticationFailed()
                                // Don't reject here - user can retry
                            }
                        })

                    val promptInfo = BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Unlock your vault")
                        .setSubtitle("Authenticate to access your documents")
                        .setAllowedAuthenticators(promptAuthenticators())
                        .build()

                    biometricPrompt.authenticate(promptInfo)
                } catch (e: Exception) {
                    settlePrompt { it.reject("BIOMETRIC_ERROR", "Failed to show biometric prompt: ${e.message}", e) }
                }
            }
        }

        AsyncFunction("put") { key: String, value: String, promise: Promise ->
            try {
                val file = vaultFile(key)
                StringEntry.write(file, value.toByteArray(), getSecretKey())
                // The nonce is in the file now; a legacy one left behind is never read.
                ivPreferences.edit().remove(key).commit()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "PUT_FAILED"), e.message, e)
            }
        }

        AsyncFunction("get") { key: String, promise: Promise ->
            try {
                val secretKey = getSecretKey()
                val file = vaultFile(key)
                if (!file.exists()) {
                    promise.reject("GET_FAILED", "File not found for key: $key", null)
                    return@AsyncFunction
                }
                val decryptedData = StringEntry.read(file, secretKey, legacyIv(key))
                promise.resolve(String(decryptedData))
            } catch (e: Exception) {
                promise.reject(failureCode(e, "GET_FAILED"), e.message, e)
            }
        }

        // Passphrase-protected backups (see BackupContainer.kt)

        AsyncFunction("exportBackup") { destPath: String, passphrase: String, extraFiles: List<Map<String, String>>, stagingDir: String, promise: Promise ->
            try {
                // Checked before anything is swept or written: only the app's own
                // backup-staging cache folder may hold export plaintext.
                val staging = BackupContainer.StagingDirectory.resolve(stagingDir, appContext.reactContext!!.cacheDir)
                val secretKey = getSecretKey()
                val entries = mutableListOf<BackupContainer.Entry>()
                for (file in vaultEntryFiles()) {
                    // Only the kind is read here; the container decrypts each entry into the
                    // staging directory when its turn comes.
                    val kind = if (VaultCrypto.isChunked(file)) "f" else "s"
                    val source = BackupContainer.Source.Staged { plain -> decryptEntry(file, plain, secretKey) }
                    entries.add(BackupContainer.Entry(file.name, kind, source))
                }
                for (extra in extraFiles) {
                    val key = extra["key"] ?: continue
                    val path = extra["path"] ?: continue
                    entries.add(BackupContainer.Entry(key, "x", BackupContainer.Source.Ready(File(path))))
                }
                val result = BackupContainer.write(File(destPath), passphrase, staging, entries) { done, total ->
                    sendEvent("backupProgress", mapOf("phase" to "export", "done" to done, "total" to total))
                }
                promise.resolve(mapOf("entries" to result.first, "bytes" to result.second))
            } catch (e: BackupContainer.StagingException) {
                promise.reject("BACKUP_STAGING_INVALID", e.message, e)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "BACKUP_EXPORT_FAILED"), e.message, e)
            }
        }

        AsyncFunction("inspectBackup") { sourcePath: String, promise: Promise ->
            try {
                val header = BackupContainer.readHeader(File(sourcePath))
                promise.resolve(
                    mapOf(
                        "version" to header.version, "app" to header.app, "created" to header.created,
                        "entries" to maxOf(0, header.entries - 1)
                    )
                )
            } catch (e: Throwable) {
                when (e) {
                    is BackupContainer.UnsupportedException -> promise.reject("BACKUP_UNSUPPORTED", e.message, e)
                    is BackupContainer.ResourceException -> promise.reject("BACKUP_RESOURCE", e.message, e)
                    is OutOfMemoryError -> promise.reject("BACKUP_RESOURCE", RESOURCE_MESSAGE, e)
                    is Exception -> promise.reject("BACKUP_INVALID", e.message, e)
                    else -> throw e
                }
            }
        }

        // Asks the running restore to stop before it removes anything. It is cooperative: the
        // restore checks the request between entries while it is still checking, so a cancel
        // during the key derivation takes effect once that ends. Returns at once: true when the
        // request will be honoured (the restore then rejects with BACKUP_CANCELLED), false once
        // the restore has passed its last cancel point and goes on to replace the vault, or when
        // [runId] is not the restore running or about to start.
        Function("cancelRestore") { runId: String ->
            restoreCancel.request(runId)
        }

        AsyncFunction("importBackup") { sourcePath: String, passphrase: String, extraDir: String, stagingDir: String, runId: String, promise: Promise ->
            var cleared = false
            // A cancel kept for this run is honoured; one for another run is dropped.
            restoreCancel.start(runId)
            try {
                // Decrypted entries may only land in the app's restore-staging cache folder.
                val staging = BackupContainer.StagingDirectory.resolve(
                    stagingDir, appContext.reactContext!!.cacheDir, BackupContainer.StagingDirectory.RESTORE_NAME
                )
                val secretKey = getSecretKey()
                val extras = File(extraDir).apply { mkdirs() }
                val restored = mutableListOf<Map<String, String>>()
                var count = 0
                // Every key is checked and every entry decrypted once before the
                // first entry is handled; the vault is only cleared after both.
                BackupContainer.read(File(sourcePath), passphrase, staging, { meta ->
                    if (!isRestoreKeyAllowed(meta)) throw BackupContainer.CorruptException("entry key ${meta.key}")
                }, { metas ->
                    if (!hasIndex(metas)) throw BackupContainer.CorruptException("no document index")
                }, { phase, done, total ->
                    sendEvent("backupProgress", mapOf("phase" to phase.wireName, "done" to done, "total" to total))
                }, { layout ->
                    preflightRestore(layout)
                    // The device key is used once before the first Restoring event: a Keystore
                    // window that lapsed during a long checking pass fails here, with the vault
                    // untouched and no Restoring event sent, so JavaScript never reads it as a
                    // failure after the wipe. The probe in the handler stays as a backstop.
                    probeKey(secretKey)
                }, cancelled = { restoreCancel.isRequested },
                    commit = { restoreCancel.commit() }) { meta, plain ->
                    // The whole handler runs with the plaintext's removal guaranteed, so a
                    // key probe or wipe failure cannot leave a decrypted entry in the cache.
                    try {
                        if (!cleared) {
                            probeKey(secretKey)
                            val previous = vaultEntryFiles()
                            // From the first removal on, a failure is a partial restore.
                            cleared = true
                            previous.forEach {
                                if (!it.delete() && it.exists()) throw IOException("Could not remove ${it.name}")
                            }
                            ivPreferences.edit().clear().apply()
                        }
                        when (meta.kind) {
                            "s" -> StringEntry.write(vaultFile(meta.key), plain.readBytes(), secretKey)
                            "f" -> VaultCrypto.encryptFile(plain, vaultFile(meta.key), secretKey)
                            "x" -> {
                                val target = contained(File(extras, meta.key), extras)
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
                // Errors are caught as well: an OutOfMemoryError from a declared length is a
                // typed refusal before the wipe and a named partial after it, instead of an
                // untyped rejection from the module runtime over a half-replaced vault.
                if (e !is Exception && e !is OutOfMemoryError && !cleared) throw e
                val code = failureCode(e, "BACKUP_IMPORT_FAILED")
                // Every entry had already decrypted once, so a failure after the wipe is
                // usually disk, I/O or the key, not the file; it is named either way,
                // because the old vault is gone.
                val partial = "The restore stopped after the previous vault was removed: ${e.message ?: e.javaClass.simpleName}"
                when {
                    // A key failure keeps its code even after the wipe: a lapsed window lets
                    // the caller re-authenticate and retry the whole restore, and an
                    // invalidated key names the cause. The message covers the wipe either way.
                    VaultErrors.isKeyCode(code) -> promise.reject(code, if (cleared) partial else e.message, e)
                    cleared -> promise.reject("BACKUP_PARTIAL", partial, e)
                    e is OutOfMemoryError -> promise.reject("BACKUP_RESOURCE", RESOURCE_MESSAGE, e)
                    e is BackupContainer.CancelledException -> promise.reject("BACKUP_CANCELLED", e.message, e)
                    e is BackupContainer.StagingException -> promise.reject("BACKUP_RESTORE_STAGING_INVALID", e.message, e)
                    e is BackupContainer.PassphraseException -> promise.reject("BACKUP_PASSPHRASE", e.message, e)
                    e is BackupContainer.UnsupportedException -> promise.reject("BACKUP_UNSUPPORTED", e.message, e)
                    e is BackupContainer.ResourceException -> promise.reject("BACKUP_RESOURCE", e.message, e)
                    e is BackupContainer.NoSpaceException -> promise.reject("BACKUP_NO_SPACE", e.message, e)
                    e is BackupContainer.CorruptException -> promise.reject("BACKUP_INVALID", e.message, e)
                    e is InvalidKeyException -> promise.reject("BACKUP_INVALID", e.message, e)
                    else -> promise.reject(code, e.message, e)
                }
            } finally {
                restoreCancel.finish(runId)
            }
        }

        AsyncFunction("getAllKeys") { promise: Promise ->
            try {
                promise.resolve(vaultEntryFiles().map { it.name })
            } catch (e: Exception) {
                promise.reject("GET_ALL_KEYS_FAILED", e.message, e)
            }
        }

        AsyncFunction("delete") { key: String, promise: Promise ->
            try {
                val file = vaultFile(key)
                if (file.exists()) {
                    file.delete()
                }
                ivPreferences.edit().remove(key).apply()
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
                val destFile = vaultFile(key)
                VaultCrypto.encryptFile(sourceFile, destFile, getSecretKey())
                // Chunked files carry their own nonces; drop any legacy IV for this key.
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "PUT_FILE_FAILED"), "Failed to encrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("putThumbnail") { key: String, sourcePath: String, maxPixelSize: Int, promise: Promise ->
            try {
                val jpeg = VaultCrypto.thumbnailJpeg(File(sourcePath), maxPixelSize)
                val destFile = vaultFile(key)
                VaultCrypto.encryptBytes(jpeg, destFile, getSecretKey())
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "PUT_THUMBNAIL_FAILED"), "Failed to create thumbnail: ${e.message}", e)
            }
        }

        AsyncFunction("renderPdfPages") { sourcePath: String, maxPixelSize: Int, destDir: String, promise: Promise ->
            try {
                promise.resolve(PdfPages.render(File(sourcePath), maxPixelSize, File(destDir)))
            } catch (e: Exception) {
                promise.reject(failureCode(e, "RENDER_PDF_FAILED"), "Failed to render the PDF: ${e.message}", e)
            }
        }

        AsyncFunction("getFile") { key: String, destPath: String, promise: Promise ->
            try {
                val encryptedFile = vaultFile(key)
                if (!encryptedFile.exists()) {
                    promise.reject("GET_FILE_FAILED", "Encrypted file not found for key: $key", null)
                    return@AsyncFunction
                }
                val legacyIv = ivPreferences.getString(key, null)?.let {
                    android.util.Base64.decode(it, android.util.Base64.DEFAULT)
                }
                VaultCrypto.decryptFile(encryptedFile, File(destPath), getSecretKey(), legacyIv)
                promise.resolve(destPath)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "GET_FILE_FAILED"), "Failed to decrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("deleteFile") { key: String, promise: Promise ->
            try {
                val file = vaultFile(key)
                if (file.exists()) {
                    file.delete()
                }
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DELETE_FILE_FAILED", "Failed to delete file: ${e.message}", e)
            }
        }

        // expo-file-system's delete follows a link and empties its target first.
        // The share chooser is an activity of its own; the app cannot close it.
        // The lock sweep deletes the copy, so a target picked later reads nothing.
        AsyncFunction("dismissShareSheet") { false }

        // Deletes a share copy's folder after `delayMs`, also while the chooser
        // keeps the activity paused. Only a folder directly inside the cache's
        // `share` folder qualifies. One expiry at a time: a new one replaces it.
        // The primary clip's description only, never the clip: reading the clip
        // shows Android 12's "pasted from your clipboard" toast.
        Function("clipboardStamp") { clipboardStamp() }

        Function("scheduleShareExpiry") { path: String, delayMs: Double ->
            val shareRoot = File(appContext.reactContext!!.cacheDir, "share")
            val parent = File(path).parentFile?.canonicalPath
            if (!path.startsWith("/") || parent != shareRoot.canonicalPath) {
                throw IllegalArgumentException("Not a share copy folder")
            }
            shareExpiry?.let { mainHandler.removeCallbacks(it.second) }
            val expire = Runnable {
                shareExpiry = null
                try {
                    BackupContainer.removeNoFollow(path, listOf(shareRoot))
                } catch (_: Exception) {
                    // The lock and launch sweeps remove the share folder too.
                }
            }
            shareExpiry = path to expire
            mainHandler.postDelayed(expire, delayMs.toLong().coerceAtLeast(0L))
        }

        // Cancels the expiry for `path` once its share ended; another path's is kept.
        Function("cancelShareExpiry") { path: String ->
            val pending = shareExpiry
            if (pending != null && pending.first == path) {
                mainHandler.removeCallbacks(pending.second)
                shareExpiry = null
            }
        }

        // iOS flags the folder for exclusion from device backups. Nothing to do here: the backup
        // rules expo-secure-store installs include only shared preferences (SecureStore itself
        // excluded), so the files folder, the vault entries and these folders, never leaves.
        Function("excludeFromBackup") { _: String -> }

        Function("removeTreeNoFollow") { path: String ->
            val context = appContext.reactContext!!
            // The picked backup waits in `files/restore-source`, out of the purgeable cache.
            BackupContainer.removeNoFollow(
                path,
                listOf(context.cacheDir),
                listOf(File(context.filesDir, RESTORE_SOURCE_NAME))
            )
        }

        AsyncFunction("getFileSize") { key: String, promise: Promise ->
            try {
                val file = vaultFile(key)
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

    private fun settlePrompt(outcome: (Promise) -> Unit) {
        val waiters = promptWaiters.toList()
        promptWaiters.clear()
        waiters.forEach(outcome)
    }

    /** KEY_LOCKED or KEY_INVALIDATED when the device key stopped the call, otherwise [fallback]. */
    private fun failureCode(e: Throwable, fallback: String): String = VaultErrors.keyFailureCode(e, fallback)

    /**
     * The Keystore only reports a lapsed authentication window or an invalidated key
     * when the key is used, and the verify pass can outlast the window. Using the key
     * once here makes that failure arrive with nothing removed.
     */
    private fun probeKey(key: SecretKey) {
        Cipher.getInstance("AES/GCM/NoPadding").init(Cipher.ENCRYPT_MODE, key)
    }

    /**
     * Vault entries share the app's files directory with other libraries'
     * files (the dev client's bundle, profile markers), so only names the
     * vault itself writes count: document files, thumbnails, pages, and the
     * underscore-prefixed metadata entries.
     */
    private fun isVaultEntryName(name: String): Boolean =
        name.startsWith("file_") || name.startsWith("thumb_") || name.startsWith("page_") ||
            (name.startsWith("_") && name != "ExpoVault_IVs.xml")

    /**
     * Approved key grammar: one path component, no separators or "..", with
     * one of the vault's own prefixes. Checked before any path is built.
     */
    private fun isVaultKey(key: String): Boolean =
        key.isNotEmpty() && !key.contains('/') && !key.contains('\\') && !key.contains("..") &&
            isVaultEntryName(key)

    /**
     * Restore entries: the index extra is exactly "database"; string and file
     * entries are vault keys; the check entry is "_check". The container refuses
     * every other kind in its pre-pass already; refusing it here as well keeps
     * an unknown kind from ever reaching the importer.
     */
    private fun isRestoreKeyAllowed(meta: BackupContainer.Meta): Boolean = when (meta.kind) {
        "x" -> meta.key == "database"
        "s", "f" -> isVaultKey(meta.key)
        "c" -> meta.key == "_check"
        else -> false
    }

    /**
     * The restore in JavaScript replaces the SQLite index with the "database" extra and
     * opens it with the "_database_key" string entry (see `src/data/database.ts`). Every
     * backup the app has written carries both; one without them would be refused in
     * JavaScript only after the vault had been cleared, so it is refused here, before
     * anything is derived or removed.
     */
    private fun hasIndex(metas: List<BackupContainer.Meta>): Boolean =
        metas.count { it.kind == "x" && it.key == "database" } == 1 &&
            metas.any { it.kind == "s" && it.key == "_database_key" }

    /**
     * Runs after every entry has decrypted once and before the vault is cleared. The largest
     * `s` entry must fit in memory (a trial allocation, see [BackupContainer.reserveMemory]),
     * and the restored vault plus the pass's temporary files must fit in the free space plus
     * what the old vault's entries give back, with the files written before the wipe in the
     * free space alone. Either refusal leaves the vault untouched.
     */
    private fun preflightRestore(layout: List<BackupContainer.EntryInfo>) {
        val needs = BackupContainer.restoreNeeds(layout)
        BackupContainer.reserveMemory(needs.largestString, STRING_ENTRY_COPIES)
        val filesDir = appContext.reactContext!!.filesDir
        val freed = vaultEntryFiles().sumOf { it.length() }
        val free = writableBytes(filesDir)
        BackupContainer.checkSpace(needs.disk, needs.scratch, free, freed)
    }

    /**
     * Free bytes on the data volume the vault and the cache share, see
     * [BackupContainer.writableBytes]. Nothing is cleared to make room: the system may clear
     * our own cache to satisfy `allocateBytes`, and the picked backup the restore still has to
     * read lives there. From API 26 the allocatable figure caps `File.usableSpace`, which on a
     * nearly full device counts blocks the system keeps back; if the figure cannot be had, the
     * usable space alone is used.
     */
    private fun writableBytes(directory: File): Long {
        val usable = directory.usableSpace
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return usable
        val context = appContext.reactContext!!
        val allocatable = try {
            val storage = context.getSystemService(StorageManager::class.java)
            storage?.getAllocatableBytes(storage.getUuidForPath(directory))
        } catch (e: Exception) {
            // IOException for a path with no volume, or anything else the service throws.
            null
        }
        return BackupContainer.writableBytes(usable, allocatable, treeBytes(context.cacheDir))
    }

    /** Bytes of the regular files under [root], links not followed. */
    private fun treeBytes(root: File): Long =
        root.walkTopDown()
            .onEnter { !java.nio.file.Files.isSymbolicLink(it.toPath()) }
            .filter { it.isFile && !java.nio.file.Files.isSymbolicLink(it.toPath()) }
            .sumOf { it.length() }

    /** The vault file for [key], after the grammar check and a containment check on the resolved path. */
    private fun vaultFile(key: String): File {
        if (!isVaultKey(key)) throw InvalidKeyException(key)
        val filesDir = appContext.reactContext!!.filesDir
        return contained(File(filesDir, key), filesDir)
    }

    /** Second line of defence after the grammar: the resolved path must stay inside [directory]. */
    private fun contained(target: File, directory: File): File {
        val base = directory.canonicalPath.trimEnd(File.separatorChar) + File.separator
        if (!target.canonicalPath.startsWith(base)) throw InvalidKeyException(target.name)
        return target
    }

    /**
     * Regular files that are vault entries, in a stable order. A directory that
     * cannot be read throws: an empty list would read as "no entries" (and, for
     * the database key, as a first run).
     */
    private fun vaultEntryFiles(): List<File> {
        val dir = appContext.reactContext!!.filesDir
        val files = dir.listFiles() ?: throw IOException("Could not list ${dir.name}")
        return files.filter { it.isFile && isVaultEntryName(it.name) }.sortedBy { it.name }
    }

    /**
     * Decrypts one entry with the device key into [plain]: a chunked file, a
     * string entry, or a legacy single GCM box whose IV is in preferences.
     */
    private fun decryptEntry(source: File, plain: File, key: SecretKey) {
        if (VaultCrypto.isChunked(source)) {
            VaultCrypto.decryptFile(source, plain, key, null)
            return
        }
        val bytes = StringEntry.read(source, key, legacyIv(source.name))
        try {
            plain.parentFile?.mkdirs()
            plain.writeBytes(bytes)
        } catch (e: Throwable) {
            plain.delete()
            throw e
        }
    }

    /** The IV a prototype-era entry keeps in preferences, or null. */
    private fun legacyIv(key: String): ByteArray? =
        ivPreferences.getString(key, null)?.let {
            android.util.Base64.decode(it, android.util.Base64.DEFAULT)
        }

    /**
     * What the unlock prompt accepts. Android 11 and later take a strong
     * biometric or the screen lock. Android 9 and 10 reject that combination
     * (androidx throws when the prompt is built), and with the screen lock the
     * only one they accept is any biometric or the screen lock. A weak face
     * unlock there cannot open the Keystore key: the key read that follows
     * fails as locked and the vault asks once more, with the screen lock
     * still on offer.
     */
    private fun promptAuthenticators(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        }

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keystoreProvider)
        keyStore.load(null)
        return keyStore.getKey(keyAlias, null) as? SecretKey
            ?: throw IllegalStateException("Vault key not found. Create the vault first.")
    }

    /** When the primary clip was set, or null when that cannot be told. */
    private fun clipboardStamp(): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        val context = appContext.reactContext ?: return null
        val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            ?: return null
        val description = try {
            manager.primaryClipDescription
        } catch (e: SecurityException) {
            null
        } ?: return null
        return description.timestamp.toString()
    }
}
