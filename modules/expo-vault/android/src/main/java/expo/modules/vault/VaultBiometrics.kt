package expo.modules.vault

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import javax.crypto.KeyGenerator

/**
 * Android Keystore key creation and biometric / device-credential prompt coordination.
 */
internal class VaultBiometrics(
    private val keyAlias: String,
    private val keystoreProvider: String,
) {
    private val authValiditySeconds = 300

    // Callers of the prompt that is currently open, settled together from its
    // callback. Touched on the main thread only (runOnUiThread and the main executor).
    private val promptWaiters = mutableListOf<Promise>()

    fun createVault(context: Context?, promise: Promise) {
        try {
            if (context == null) {
                promise.reject("NO_CONTEXT", "Application context not available", null)
                return
            }

            val biometricManager = BiometricManager.from(context)
            when (biometricManager.canAuthenticate(promptAuthenticators())) {
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                    promise.reject(
                        "NO_AUTH_ENROLLED",
                        "Please set up screen lock (PIN, pattern, or biometrics) in your device settings first",
                        null,
                    )
                    return
                }
            }

            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, keystoreProvider)
            val parameterSpecBuilder = KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)

            // Timeout-based key: any successful biometric or device-credential prompt
            // unlocks it for the window below (ADR 0003).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                parameterSpecBuilder.setUserAuthenticationParameters(
                    authValiditySeconds,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL,
                )
            } else {
                @Suppress("DEPRECATION")
                parameterSpecBuilder.setUserAuthenticationValidityDurationSeconds(authValiditySeconds)
            }

            keyGenerator.init(parameterSpecBuilder.build())
            keyGenerator.generateKey()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("KEY_CREATION_FAILED", "Failed to create vault: ${e.message}", e)
        }
    }

    fun biometryType(context: Context?, promise: Promise) {
        if (context == null) {
            promise.resolve("none")
            return
        }
        val available = BiometricManager.from(context)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
        // Android does not expose which biometric is enrolled; "biometrics" keeps the copy honest.
        promise.resolve(if (available) "biometrics" else "none")
    }

    fun unlockWithBiometrics(activity: FragmentActivity?, promise: Promise) {
        if (activity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Unable to show biometric prompt. Please try again.", null)
            return
        }

        activity.runOnUiThread {
            // Once the activity has saved its state, androidx refuses to show the
            // prompt without calling back, which would leave this promise pending.
            if (activity.isFinishing || activity.isDestroyed || activity.supportFragmentManager.isStateSaved) {
                promise.resolve(false)
                return@runOnUiThread
            }
            // androidx keeps one prompt callback per activity: callers arriving while
            // a prompt is open wait for its outcome instead of replacing its callback.
            if (promptWaiters.isNotEmpty()) {
                promptWaiters.add(promise)
                return@runOnUiThread
            }
            promptWaiters.add(promise)
            try {
                val executor = ContextCompat.getMainExecutor(activity)
                val biometricPrompt = BiometricPrompt(
                    activity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            settlePrompt { it.resolve(true) }
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            when (errorCode) {
                                BiometricPrompt.ERROR_USER_CANCELED,
                                BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                                BiometricPrompt.ERROR_CANCELED -> settlePrompt { it.resolve(false) }
                                else -> settlePrompt { it.reject("BIOMETRIC_AUTH_FAILED", errString.toString(), null) }
                            }
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                        }
                    },
                )

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

    private fun settlePrompt(outcome: (Promise) -> Unit) {
        val waiters = promptWaiters.toList()
        promptWaiters.clear()
        waiters.forEach(outcome)
    }

    /**
     * What the unlock prompt accepts. Android 11+ takes a strong biometric or the screen lock;
     * Android 9 and 10 only accept weak biometric or device credential with screen lock.
     */
    private fun promptAuthenticators(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        }
}
