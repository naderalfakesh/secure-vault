package expo.modules.vault

import android.security.keystore.KeyProperties
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** What Settings says about the Keystore key, from the levels the system reports. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class KeyProtectionTest {
    @Test
    fun namesEverySecurityLevel() {
        assertEquals("strongbox", KeyProtection.forSecurityLevel(KeyProperties.SECURITY_LEVEL_STRONGBOX))
        assertEquals("trusted-environment", KeyProtection.forSecurityLevel(KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT))
        assertEquals("trusted-environment", KeyProtection.forSecurityLevel(KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE))
        assertEquals("software", KeyProtection.forSecurityLevel(KeyProperties.SECURITY_LEVEL_SOFTWARE))
        assertEquals("software", KeyProtection.forSecurityLevel(KeyProperties.SECURITY_LEVEL_UNKNOWN))
    }

    @Test
    fun readsSecureHardwareBeforeApi31AsTheTrustedEnvironment() {
        assertEquals("trusted-environment", KeyProtection.forSecureHardware(true))
        assertEquals("software", KeyProtection.forSecureHardware(false))
    }
}
