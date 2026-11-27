package expo.modules.vault

import java.io.File
import java.io.IOException

object VaultFiles {
    /** Idempotent delete that throws when File.delete() silently returns false on an existing file. */
    @Throws(IOException::class)
    fun remove(file: File) {
        if (!file.delete() && file.exists()) throw IOException("Could not remove ${file.name}")
    }
}
