package expo.modules.vault

import android.os.Build
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory

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

    fun forSecurityLevel(level: Int): String = when (level) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> STRONGBOX
        // UNKNOWN_SECURE is secure hardware of an unnamed type.
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT,
        KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE -> TRUSTED_ENVIRONMENT
        else -> SOFTWARE
    }

    fun forSecureHardware(inside: Boolean): String = if (inside) TRUSTED_ENVIRONMENT else SOFTWARE
}
