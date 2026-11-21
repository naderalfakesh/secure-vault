package expo.modules.vault

import java.io.File
import java.io.IOException

/** Removing vault entries from disk. */
object VaultFiles {
    /**
     * Removes [file]. One that is already gone counts as removed, so a delete can be
     * repeated; one the system keeps is an error, because [File.delete] only returns
     * false and the caller would otherwise report an entry as deleted that is still there.
     */
    @Throws(IOException::class)
    fun remove(file: File) {
        if (!file.delete() && file.exists()) throw IOException("Could not remove ${file.name}")
    }
}
