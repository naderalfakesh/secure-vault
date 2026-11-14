package expo.modules.vault

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.nio.file.Files
import java.security.SecureRandom

/** SVB1, the passphrase backup that moves a vault between Android and iPhone. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BackupContainerTest {
    @get:Rule val temp = TemporaryFolder()

    private lateinit var cache: File
    private val passphrase = "correct horse battery staple"

    @Before
    fun setUp() {
        cache = temp.newFolder("cache")
    }

    /**
     * The folder is created first: Robolectric's `Os.lstat` reports a missing path as a link
     * instead of raising ENOENT, so the "missing is fine" branch only holds on a device.
     */
    private fun staging(): BackupContainer.StagingDirectory {
        val dir = File(cache, BackupContainer.StagingDirectory.NAME).apply { mkdirs() }
        return BackupContainer.StagingDirectory.resolve(dir.path, cache)
    }

    private fun stagingIsEmpty() = File(cache, BackupContainer.StagingDirectory.NAME).list().isNullOrEmpty()

    /** What `handle` was given, in order: key, kind and the plaintext as text-safe hex. */
    private data class Restored(val key: String, val kind: String, val plaintext: List<Byte>)

    private fun restore(
        source: File,
        passphrase: String,
        cancelled: () -> Boolean = { false },
        preflight: (List<BackupContainer.EntryInfo>) -> Unit = {},
    ): List<Restored> {
        val restored = mutableListOf<Restored>()
        BackupContainer.read(
            source, passphrase, staging(), validate = {}, progress = { _, _, _ -> },
            preflight = preflight, cancelled = cancelled,
        ) { meta, plain -> restored.add(Restored(meta.key, meta.kind, plain.readBytes().toList())) }
        return restored
    }

    private fun outcome(error: Throwable) = when (error) {
        is BackupContainer.CorruptException -> "corrupt"
        is BackupContainer.PassphraseException -> "passphrase"
        is BackupContainer.UnsupportedException -> "unsupported"
        is BackupContainer.CancelledException -> "cancelled"
        else -> "other: $error"
    }

    /**
     * Every vector, including the ones damaged only in their last entry: the restore must either
     * hand over every entry or refuse before `handle` sees the first one, and leave no plaintext
     * in staging either way.
     */
    @Test
    fun meetsEveryBackupVector() {
        for (vector in Fixtures.list("backups")) {
            val name = vector.getString("name")
            var restored = emptyList<Restored>()
            val result = try {
                restored = restore(Fixtures.file(vector.getString("file")), vector.getString("passphrase"))
                "ok"
            } catch (e: Exception) {
                outcome(e)
            }
            assertEquals(name, vector.getString("expect"), result)
            if (result == "ok") {
                val expected = vector.getJSONArray("entries").objects().map {
                    Restored(it.getString("key"), it.getString("kind"), Fixtures.bytes(it.getString("plaintext")).toList())
                }
                assertEquals(name, expected, restored)
            } else {
                assertTrue("$name reached handle", restored.isEmpty())
            }
            assertTrue("$name left files in staging", stagingIsEmpty())
        }
    }

    /** 2,000,000,000 PBKDF2 rounds would take hours; the header is refused first. */
    @Test
    fun refusesAnUnsupportedIterationCountBeforeDerivingAKey() {
        val started = System.nanoTime()
        val error = assertThrows(Exception::class.java) { restore(Fixtures.file("backup-iterations.bin"), "x") }
        assertEquals("unsupported", outcome(error))
        assertTrue((System.nanoTime() - started) / 1_000_000_000.0 < 5)
    }

    @Test
    fun writesABackupItReadsBack() {
        val indexBytes = ByteArray(3 * 1024).also { SecureRandom().nextBytes(it) }
        val index = temp.newFile("index.db").apply { writeBytes(indexBytes) }
        val document = ByteArray(VaultCrypto.CHUNK_SIZE + 100).also { SecureRandom().nextBytes(it) }
        val steps = mutableListOf<Int>()

        val destination = temp.root.resolve("round-trip.bin")
        val (entries, _) = BackupContainer.write(
            destination, "a passphrase", staging(),
            listOf(
                BackupContainer.Entry("_database_key", "s", BackupContainer.Source.Staged { it.writeText("db key") }),
                BackupContainer.Entry("doc-1.jpg", "f", BackupContainer.Source.Staged { it.writeBytes(document) }),
                BackupContainer.Entry("database", "x", BackupContainer.Source.Ready(index)),
            ),
        ) { done, _ -> steps.add(done) }
        assertEquals(3, entries)
        assertEquals(listOf(1, 2, 3, 4), steps)
        assertTrue(stagingIsEmpty())

        val header = BackupContainer.readHeader(destination)
        assertEquals(600_000, header.iterations)
        assertEquals(4, header.entries)

        assertEquals(
            listOf(
                Restored("_database_key", "s", "db key".toByteArray().toList()),
                Restored("doc-1.jpg", "f", document.toList()),
                Restored("database", "x", indexBytes.toList()),
            ),
            restore(destination, "a passphrase"),
        )
    }

    @Test
    fun aCancelBeforeTheRestorePassChangesNothing() {
        val error = assertThrows(Exception::class.java) {
            restore(Fixtures.file("backup.bin"), passphrase, cancelled = { true })
        }
        assertEquals("cancelled", outcome(error))
        assertTrue(stagingIsEmpty())
    }

    @Test
    fun aPreflightRefusalStopsBeforeHandle() {
        class NoRoom : Exception()
        assertThrows(NoRoom::class.java) {
            restore(Fixtures.file("backup.bin"), passphrase, preflight = { throw NoRoom() })
        }
    }

    @Test
    fun worksOutWhatARestoreNeeds() {
        val layout = BackupContainer.readLayout(Fixtures.file("backup.bin"))
        assertEquals(listOf("_check", "_database_key", "doc-1.jpg", "database"), layout.map { it.meta.key })
        val sizes = layout.associate { it.meta.key to it.payloadLength }
        val needs = BackupContainer.restoreNeeds(layout)
        assertEquals(sizes.getValue("_database_key") - 8, needs.largestString)
        val restored = sizes.getValue("_database_key") + sizes.getValue("doc-1.jpg") + sizes.getValue("database")
        assertEquals(restored + 2 * sizes.getValue("doc-1.jpg") + sizes.getValue("database"), needs.disk)
        assertEquals(2 * sizes.getValue("_database_key"), needs.scratch)
    }

    @Test
    fun onlyTheAppsOwnStagingFolderIsAccepted() {
        val elsewhere = temp.newFolder("elsewhere")
        val link = File(cache, BackupContainer.StagingDirectory.NAME)
        Files.createSymbolicLink(link.toPath(), elsewhere.toPath())

        for (requested in listOf("relative/backup-staging", cache.path, elsewhere.path, link.path)) {
            assertThrows(requested, BackupContainer.StagingException::class.java) {
                BackupContainer.StagingDirectory.resolve(requested, cache)
            }
        }
    }

    @Test
    fun aSweepClearsLeftoverPlaintext() {
        val staging = staging()
        BackupContainer.sweep(staging)
        File(staging.dir, "plain-1").writeText("left by a killed export")
        BackupContainer.sweep(staging)
        assertTrue(stagingIsEmpty())
    }
}
