package expo.modules.vault

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** SVS1, the Android string entry that holds the index key and the key probe. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StringEntryTest {
    @get:Rule val temp = TemporaryFolder()

    @Test
    fun readsTheEntryVector() {
        val vector = Fixtures.vectors.getJSONObject("stringEntry")
        val entry = Fixtures.file(vector.getString("file"))
        assertTrue(StringEntry.isInline(entry.readBytes()))
        assertArrayEquals(Fixtures.bytes(vector.getString("plaintext")), StringEntry.read(entry, Fixtures.key, null))
    }

    /** Entries from before SVS1 keep their nonce in SharedPreferences until they are written again. */
    @Test
    fun readsAnOlderEntryThroughItsStoredNonce() {
        val vector = Fixtures.vectors.getJSONObject("legacyStringEntry")
        val entry = Fixtures.file(vector.getString("file"))
        assertFalse(StringEntry.isInline(entry.readBytes()))
        val plain = StringEntry.read(entry, Fixtures.key, Fixtures.hex(vector.getString("nonce")))
        assertArrayEquals(Fixtures.bytes(vector.getString("plaintext")), plain)
    }

    @Test
    fun anOlderEntryWithoutItsNonceIsAnError() {
        val entry = Fixtures.file(Fixtures.vectors.getJSONObject("legacyStringEntry").getString("file"))
        assertThrows(IllegalStateException::class.java) { StringEntry.read(entry, Fixtures.key, null) }
    }

    @Test
    fun writesAnEntryItReadsBackAndLeavesNoTemporaryFile() {
        val entry = temp.root.resolve("_database_key")
        StringEntry.write(entry, "first".toByteArray(), Fixtures.key)
        StringEntry.write(entry, "second".toByteArray(), Fixtures.key)
        assertArrayEquals("second".toByteArray(), StringEntry.read(entry, Fixtures.key, null))
        assertEquals(listOf("_database_key"), temp.root.list()!!.toList())
        // Magic, nonce, ciphertext, tag.
        assertEquals(4L + 12 + "second".length + 16, entry.length())
    }

    @Test
    fun anAlteredEntryFailsItsTag() {
        val entry = temp.root.resolve("_key_probe")
        StringEntry.write(entry, "probe".toByteArray(), Fixtures.key)
        val bytes = entry.readBytes().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
        entry.writeBytes(bytes)
        assertThrows(Exception::class.java) { StringEntry.read(entry, Fixtures.key, null) }
    }

    @Test
    fun aCutEntryIsCorrupt() {
        val entry = temp.root.resolve("_key_probe").apply { writeBytes("SVS1".toByteArray() + ByteArray(20)) }
        assertThrows(VaultCrypto.CorruptException::class.java) { StringEntry.read(entry, Fixtures.key, null) }
    }
}
