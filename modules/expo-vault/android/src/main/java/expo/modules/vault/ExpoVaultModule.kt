package expo.modules.vault

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class ExpoVaultModule : Module() {

    private val keyAlias = "encryptionKey"
    private val AUTH_VALIDITY_SECONDS = 300
    private val keystoreProvider = "AndroidKeyStore"
    private val ivPreferences: SharedPreferences by lazy {
        appContext.reactContext!!.getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoVault")

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
                try {
                    val executor = ContextCompat.getMainExecutor(activity)
                    val biometricPrompt = BiometricPrompt(activity, executor,
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                super.onAuthenticationSucceeded(result)
                                promise.resolve(true)
                            }

                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                super.onAuthenticationError(errorCode, errString)
                                when (errorCode) {
                                    // Dismissing the prompt is a choice, not a failure: the
                                    // caller falls back to the PIN without showing an error.
                                    BiometricPrompt.ERROR_USER_CANCELED,
                                    BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                                    BiometricPrompt.ERROR_CANCELED -> promise.resolve(false)
                                    else -> promise.reject("BIOMETRIC_AUTH_FAILED", errString.toString(), null)
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
                    promise.reject("BIOMETRIC_ERROR", "Failed to show biometric prompt: ${e.message}", e)
                }
            }
        }

        AsyncFunction("put") { key: String, value: String, promise: Promise ->
            try {
                val secretKey = getSecretKey()
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.ENCRYPT_MODE, secretKey)

                val iv = cipher.iv
                ivPreferences.edit().putString(key, android.util.Base64.encodeToString(iv, android.util.Base64.DEFAULT)).apply()

                val encryptedData = cipher.doFinal(value.toByteArray())
                val file = File(appContext.reactContext!!.filesDir, key)
                file.writeBytes(encryptedData)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("PUT_FAILED", e.message, e)
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

                val file = File(appContext.reactContext!!.filesDir, key)
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
                promise.reject("GET_FAILED", e.message, e)
            }
        }

        AsyncFunction("exportEncrypted") { promise: Promise ->
            try {
                val filesDir = appContext.reactContext!!.filesDir
                val exportedData = JSONObject()
                filesDir.listFiles()?.forEach { file ->
                    val fileName = file.name
                    if (fileName != "ExpoVault_IVs.xml") { // Don't export the IV preferences file
                        val fileData = file.readBytes()
                        exportedData.put(fileName, android.util.Base64.encodeToString(fileData, android.util.Base64.DEFAULT))
                    }
                }
                promise.resolve(exportedData.toString())
            } catch (e: Exception) {
                promise.reject("EXPORT_FAILED", e.message, e)
            }
        }

        AsyncFunction("importEncrypted") { jsonString: String, promise: Promise ->
            try {
                val filesDir = appContext.reactContext!!.filesDir
                filesDir.listFiles()?.forEach { file ->
                    if (file.name != "ExpoVault_IVs.xml") {
                        file.delete()
                    }
                }

                val importedData = JSONObject(jsonString)
                importedData.keys().forEach { fileName ->
                    val base64String = importedData.getString(fileName)
                    val fileData = android.util.Base64.decode(base64String, android.util.Base64.DEFAULT)
                    val file = File(filesDir, fileName)
                    file.writeBytes(fileData)
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("IMPORT_FAILED", e.message, e)
            }
        }

        AsyncFunction("getAllKeys") { promise: Promise ->
            try {
                val filesDir = appContext.reactContext!!.filesDir
                val keys = filesDir.listFiles()?.map { it.name }?.filter { it != "ExpoVault_IVs.xml" }
                promise.resolve(keys)
            } catch (e: Exception) {
                promise.reject("GET_ALL_KEYS_FAILED", e.message, e)
            }
        }

        AsyncFunction("delete") { key: String, promise: Promise ->
            try {
                val file = File(appContext.reactContext!!.filesDir, key)
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
                val destFile = File(appContext.reactContext!!.filesDir, key)
                VaultCrypto.encryptFile(sourceFile, destFile, getSecretKey())
                // Chunked files carry their own nonces; drop any legacy IV for this key.
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("PUT_FILE_FAILED", "Failed to encrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("putThumbnail") { key: String, sourcePath: String, maxPixelSize: Int, promise: Promise ->
            try {
                val jpeg = VaultCrypto.thumbnailJpeg(File(sourcePath), maxPixelSize)
                val destFile = File(appContext.reactContext!!.filesDir, key)
                VaultCrypto.encryptBytes(jpeg, destFile, getSecretKey())
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("PUT_THUMBNAIL_FAILED", "Failed to create thumbnail: ${e.message}", e)
            }
        }

        AsyncFunction("getFile") { key: String, destPath: String, promise: Promise ->
            try {
                val encryptedFile = File(appContext.reactContext!!.filesDir, key)
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
                promise.reject("GET_FILE_FAILED", "Failed to decrypt file: ${e.message}", e)
            }
        }

        AsyncFunction("deleteFile") { key: String, promise: Promise ->
            try {
                val file = File(appContext.reactContext!!.filesDir, key)
                if (file.exists()) {
                    file.delete()
                }
                ivPreferences.edit().remove(key).apply()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DELETE_FILE_FAILED", "Failed to delete file: ${e.message}", e)
            }
        }

        AsyncFunction("getFileSize") { key: String, promise: Promise ->
            try {
                val file = File(appContext.reactContext!!.filesDir, key)
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

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keystoreProvider)
        keyStore.load(null)
        return keyStore.getKey(keyAlias, null) as? SecretKey
            ?: throw IllegalStateException("Vault key not found. Create the vault first.")
    }
}
