package expo.modules.vault

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.StatFs
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
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class ExpoVaultModule : Module() {
    class InvalidKeyException(key: String) : IllegalArgumentException("Invalid vault key: $key")

    private val keyAlias = "encryptionKey"
    private val RESOURCE_MESSAGE = "This device does not have enough memory to read this backup."
    /**
     * Copies of an `s` plaintext the restore pass holds at once: `readBytes`, the Keystore
     * cipher's growing output buffer (up to twice the result while it doubles) and the result
     * array. Provisional until measured on the S-s fixtures; never below 3.
     */
    private val STRING_ENTRY_COPIES = 4
    private val AUTH_VALIDITY_SECONDS = 300
    private val keystoreProvider = "AndroidKeyStore"
    // Callers of the prompt that is currently open, settled together from its
    // callback. Touched on the main thread only (runOnUiThread and the main executor).
    private val promptWaiters = mutableListOf<Promise>()
    // Set by cancelRestore and read by the running restore between entries of its checking pass.
    // importBackup clears it when it starts, so a cancel that arrived after an earlier restore
    // ended cannot stop the next one; the JavaScript caller repeats a cancel on the restore's
    // first progress event in case it landed before that.
    private val restoreCancel = AtomicBoolean(false)
    private val ivPreferences: SharedPreferences by lazy {
        appContext.reactContext!!.getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoVault")

        Events("backupProgress")

        AsyncFunction("createVault") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.reject("NO_CONTEXT", "Application context not available", null)
                    return@AsyncFunction
                }

                val biometricManager = BiometricManager.from(context)
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                when (biometricManager.canAuthenticate(authenticators)) {
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
                // does not do yet; that is the Phase 3 vault rework.
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
                        .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                            BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        )
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
                val secretKey = getSecretKey()
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.ENCRYPT_MODE, secretKey)

                val iv = cipher.iv
                ivPreferences.edit().putString(key, android.util.Base64.encodeToString(iv, android.util.Base64.DEFAULT)).apply()

                val encryptedData = cipher.doFinal(value.toByteArray())
                file.writeBytes(encryptedData)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject(failureCode(e, "PUT_FAILED"), e.message, e)
            }
        }

        AsyncFunction("get") { key: String, promise: Promise ->
            try {
                val secretKey = getSecretKey()
                val ivString = ivPreferences.getString(key, null)
                if (ivString == null) {
                    promise.reject("GET_FAILED", "IV not found for key: $key", null)
                    return@AsyncFunction
                }
                val iv = android.util.Base64.decode(ivString, android.util.Base64.DEFAULT)

                val file = vaultFile(key)
                if (!file.exists()) {
                    promise.reject("GET_FAILED", "File not found for key: $key", null)
                    return@AsyncFunction
                }
                val encryptedData = file.readBytes()

                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                val spec = GCMParameterSpec(128, iv)
                cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

                val decryptedData = cipher.doFinal(encryptedData)
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
        // restore checks the flag between entries while it is still checking, so a cancel during
        // the key derivation takes effect once that ends, and one after the checking pass has no
        // effect at all. Returns at once; the restore rejects with BACKUP_CANCELLED if it stopped.
        Function("cancelRestore") {
            restoreCancel.set(true)
        }

        AsyncFunction("importBackup") { sourcePath: String, passphrase: String, extraDir: String, stagingDir: String, promise: Promise ->
            var cleared = false
            restoreCancel.set(false)
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
                }, cancelled = { restoreCancel.get() }) { meta, plain ->
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
                            "s" -> {
                                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                                cipher.init(Cipher.ENCRYPT_MODE, secretKey)
                                ivPreferences.edit().putString(meta.key, android.util.Base64.encodeToString(cipher.iv, android.util.Base64.DEFAULT)).apply()
                                vaultFile(meta.key).writeBytes(cipher.doFinal(plain.readBytes()))
                            }
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
        Function("removeTreeNoFollow") { path: String ->
            BackupContainer.removeNoFollow(path, listOf(appContext.reactContext!!.cacheDir))
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
     * what the old vault's entries give back. Either refusal leaves the vault untouched.
     */
    private fun preflightRestore(layout: List<BackupContainer.EntryInfo>) {
        val needs = BackupContainer.restoreNeeds(layout)
        BackupContainer.reserveMemory(needs.largestString, STRING_ENTRY_COPIES)
        val filesDir = appContext.reactContext!!.filesDir
        val freed = vaultEntryFiles().sumOf { it.length() }
        BackupContainer.checkSpace(needs.disk, StatFs(filesDir.path).availableBytes, freed)
    }

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

    /** Decrypts one entry with the device key into [plain]; a legacy single GCM box keeps its IV in preferences. */
    private fun decryptEntry(source: File, plain: File, key: SecretKey) {
        if (VaultCrypto.isChunked(source)) {
            VaultCrypto.decryptFile(source, plain, key, null)
            return
        }
        val iv = ivPreferences.getString(source.name, null)?.let {
            android.util.Base64.decode(it, android.util.Base64.DEFAULT)
        }
        VaultCrypto.decryptFile(source, plain, key, iv)
    }

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keystoreProvider)
        keyStore.load(null)
        return keyStore.getKey(keyAlias, null) as? SecretKey
            ?: throw IllegalStateException("Vault key not found. Create the vault first.")
    }
}
