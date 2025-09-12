package expo.modules.vault

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
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
    private val keystoreProvider = "AndroidKeyStore"
    private val ivPreferences: SharedPreferences by lazy {
        appContext.reactContext!!.getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoVault")

        AsyncFunction("createVault") { promise: Promise ->
            try {
                val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, keystoreProvider)
                val parameterSpec = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setUserAuthenticationRequired(true)
                    .build()

                keyGenerator.init(parameterSpec)
                keyGenerator.generateKey()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("KEY_CREATION_FAILED", e.message)
            }
        }

        AsyncFunction("unlockWithBiometrics") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity
            if (activity == null) {
                promise.reject("ACTIVITY_NOT_FOUND", "Activity not found")
                return@AsyncFunction
            }

            val executor = ContextCompat.getMainExecutor(activity)
            val biometricPrompt = BiometricPrompt(activity, executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        promise.resolve(true)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        promise.reject("BIOMETRIC_AUTH_FAILED", errString.toString())
                    }
                })

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock your vault")
                .setSubtitle("Authenticate to access your notes")
                .setNegativeButtonText("Cancel")
                .build()

            biometricPrompt.authenticate(promptInfo)
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
                promise.reject("PUT_FAILED", e.message)
            }
        }

        AsyncFunction("get") { key: String, promise: Promise ->
            try {
                val secretKey = getSecretKey()
                val ivString = ivPreferences.getString(key, null)
                if (ivString == null) {
                    promise.reject("GET_FAILED", "IV not found for key: $key")
                    return@AsyncFunction
                }
                val iv = android.util.Base64.decode(ivString, android.util.Base64.DEFAULT)

                val file = File(appContext.reactContext!!.filesDir, key)
                if (!file.exists()) {
                    promise.reject("GET_FAILED", "File not found for key: $key")
                    return@AsyncFunction
                }
                val encryptedData = file.readBytes()

                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                val spec = GCMParameterSpec(128, iv)
                cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

                val decryptedData = cipher.doFinal(encryptedData)
                promise.resolve(String(decryptedData))
            } catch (e: Exception) {
                promise.reject("GET_FAILED", e.message)
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
                promise.reject("EXPORT_FAILED", e.message)
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
                promise.reject("IMPORT_FAILED", e.message)
            }
        }

        AsyncFunction("getAllKeys") { promise: Promise ->
            try {
                val filesDir = appContext.reactContext!!.filesDir
                val keys = filesDir.listFiles()?.map { it.name }?.filter { it != "ExpoVault_IVs.xml" }
                promise.resolve(keys)
            } catch (e: Exception) {
                promise.reject("GET_ALL_KEYS_FAILED", e.message)
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
                promise.reject("DELETE_FAILED", e.message)
            }
        }
    }

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keystoreProvider)
        keyStore.load(null)
        return keyStore.getKey(keyAlias, null) as SecretKey
    }
}
