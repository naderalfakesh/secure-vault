package expo.modules.vault

import android.os.Build
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory

/**
 * Where the Keystore keeps the vault key, for Settings (ADR 0009). The key is
 * generated inside the Keystore and never leaves it; this only reports which
 * hardware the system says holds it. Reading the key's [KeyInfo] uses no key
 * material, so it needs no authentication.
 */
object KeyProtection {
    const val STRONGBOX = "strongbox"
    const val TRUSTED_ENVIRONMENT = "trusted-environment"
    const val SOFTWARE = "software"
    const val NONE = "none"

    fun of(keyStore: KeyStore, alias: String): String {
        val key = keyStore.getKey(alias, null) as? SecretKey ?: return NONE
        val info = SecretKeyFactory.getInstance(key.algorithm, keyStore.provider)
            .getKeySpec(key, KeyInfo::class.java) as KeyInfo
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            forSecurityLevel(info.securityLevel)
        } else {
            @Suppress("DEPRECATION")
            forSecureHardware(info.isInsideSecureHardware)
        }
    }

    /** API 31 and later: the Keystore's own answer. */
    fun forSecurityLevel(level: Int): String = when (level) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> STRONGBOX
        // UNKNOWN_SECURE is secure hardware of a kind the system does not name.
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT,
        KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE -> TRUSTED_ENVIRONMENT
        else -> SOFTWARE
    }

    /**
     * Before API 31 the Keystore only says whether the key is in secure
     * hardware. The vault never asks for StrongBox, so secure hardware is the
     * trusted execution environment.
     */
    fun forSecureHardware(inside: Boolean): String = if (inside) TRUSTED_ENVIRONMENT else SOFTWARE
}
