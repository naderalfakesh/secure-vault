package expo.modules.vault

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.security.SecureRandom
import javax.crypto.KeyGenerator

/** SVC1, the chunked AES-256-GCM stream every vault file and backup payload uses. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class VaultCryptoTest {
    @get:Rule val temp = TemporaryFolder()

    @Test
    fun decryptsEveryStreamVector() {
        for (vector in Fixtures.list("streams")) {
            val name = vector.getString("name")
            val output = temp.newFile()
            VaultCrypto.decryptFile(Fixtures.file(vector.getString("file")), output, Fixtures.key, null)
            assertArrayEquals(name, Fixtures.bytes(vector.getString("plaintext")), output.readBytes())
            VaultCrypto.verifyFile(Fixtures.file(vector.getString("file")), Fixtures.key)
        }
    }

    @Test
    fun refusesEveryBrokenStreamAndLeavesNoPlaintext() {
        for (vector in Fixtures.list("brokenStreams")) {
            val name = vector.getString("name")
            val source = Fixtures.file(vector.getString("file"))
            val output = temp.root.resolve("plain-${System.nanoTime()}")
            assertThrows(name, Exception::class.java) { VaultCrypto.decryptFile(source, output, Fixtures.key, null) }
            assertFalse("$name left plaintext behind", output.exists())
            assertThrows(name, Exception::class.java) { VaultCrypto.verifyFile(source, Fixtures.key) }
        }
    }

    @Test
    fun refusesTheRightStreamUnderAnotherKey() {
        val other = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val output = temp.root.resolve("plain")
        assertThrows(Exception::class.java) {
            VaultCrypto.decryptFile(Fixtures.file("stream-multichunk.bin"), output, other, null)
        }
        assertFalse(output.exists())
    }

    @Test
    fun readsThe2025PrototypeFileWithItsStoredNonce() {
        val vector = Fixtures.vectors.getJSONObject("legacyAndroid")
        val output = temp.newFile()
        VaultCrypto.decryptFile(
            Fixtures.file(vector.getString("file")), output, Fixtures.key, Fixtures.hex(vector.getString("nonce")),
        )
        assertArrayEquals(Fixtures.bytes(vector.getString("plaintext")), output.readBytes())
    }

    /** Sizes around the 1 MiB chunk boundary, where an off-by-one would drop or repeat bytes. */
    @Test
    fun roundTripsAcrossChunkBoundaries() {
        val chunk = VaultCrypto.CHUNK_SIZE
        for (size in listOf(0, 1, chunk - 1, chunk, chunk + 1, 2 * chunk + 7)) {
            val plain = ByteArray(size).also { SecureRandom().nextBytes(it) }
            val source = temp.newFile().apply { writeBytes(plain) }
            val sealed = temp.newFile()
            val opened = temp.newFile()
            VaultCrypto.encryptFile(source, sealed, Fixtures.key)
            VaultCrypto.decryptFile(sealed, opened, Fixtures.key, null)
            assertArrayEquals("$size bytes", plain, opened.readBytes())

            val chunks = (size + chunk - 1) / chunk
            assertEquals("$size bytes", 8L + size + chunks * (4 + 12 + 16), sealed.length())
            assertArrayEquals("SVC1".toByteArray(), sealed.readBytes().copyOf(4))
        }
    }

    @Test
    fun sealsTheSamePlaintextDifferentlyEachTime() {
        val first = temp.newFile()
        val second = temp.newFile()
        VaultCrypto.encryptBytes("same plaintext".toByteArray(), first, Fixtures.key)
        VaultCrypto.encryptBytes("same plaintext".toByteArray(), second, Fixtures.key)
        assertFalse(first.readBytes().contentEquals(second.readBytes()))
    }
}
