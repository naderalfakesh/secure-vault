package expo.modules.vault

import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.UserNotAuthenticatedException

/** Promise codes for failures that are about the device key rather than the operation. */
object VaultErrors {
    const val KEY_LOCKED = "KEY_LOCKED"
    const val KEY_INVALIDATED = "KEY_INVALIDATED"

    /**
     * A lapsed authentication window gets its own code so the caller can re-prompt and
     * retry. A key the system has invalidated (biometrics re-enrolled, lock screen removed)
     * gets another, because no retry can bring it back. Anything else keeps [fallback].
     */
    fun keyFailureCode(error: Throwable, fallback: String): String {
        var cause: Throwable? = error
        while (cause != null) {
            if (cause is UserNotAuthenticatedException) return KEY_LOCKED
            if (cause is KeyPermanentlyInvalidatedException) return KEY_INVALIDATED
            cause = cause.cause
        }
        return fallback
    }

    /** True for the codes above: the key, not the file or the disk, stopped the operation. */
    fun isKeyCode(code: String): Boolean = code == KEY_LOCKED || code == KEY_INVALIDATED
}
