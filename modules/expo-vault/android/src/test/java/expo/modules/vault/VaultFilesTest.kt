package expo.modules.vault

import java.io.File
import java.io.IOException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** Removing an entry: gone is fine, kept is an error. */
class VaultFilesTest {
    @get:Rule val temp = TemporaryFolder()

    @Test
    fun removesAnEntry() {
        val entry = temp.newFile("entry")
        VaultFiles.remove(entry)
        assertFalse(entry.exists())
    }

    @Test
    fun anEntryThatIsAlreadyGoneCountsAsRemoved() {
        VaultFiles.remove(File(temp.root, "missing"))
    }

    /** A folder with something in it is the one thing `File.delete` refuses everywhere. */
    @Test
    fun anEntryTheSystemKeepsIsAnError() {
        val kept = temp.newFolder("kept")
        File(kept, "inside").writeText("x")
        assertThrows(IOException::class.java) { VaultFiles.remove(kept) }
        assertTrue(kept.exists())
    }
}
