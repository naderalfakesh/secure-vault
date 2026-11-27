package expo.modules.vault

import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import java.io.File

internal object BackupStaging {
    /** What sits at a path, without following a link at the path itself. */
    private enum class EntryKind { MISSING, DIRECTORY, LINK, OTHER }

    /**
     * lstat-based, so a symbolic link is reported as a link and never as what it points at.
     * `android.system.Os` has been available since API 21; `java.nio.file` needs API 26, above the
     * app's minimum. Any error other than "no such entry" is reported as OTHER so the caller refuses it.
     */
    private fun entryKind(file: File): EntryKind {
        val mode = try {
            Os.lstat(file.path).st_mode
        } catch (e: ErrnoException) {
            return if (e.errno == OsConstants.ENOENT) EntryKind.MISSING else EntryKind.OTHER
        }
        return when {
            OsConstants.S_ISLNK(mode) -> EntryKind.LINK
            OsConstants.S_ISDIR(mode) -> EntryKind.DIRECTORY
            else -> EntryKind.OTHER
        }
    }

    fun resolveDir(requested: String, cacheDir: File, name: String): File {
        if (!requested.startsWith("/")) throw BackupContainer.StagingException("not an absolute path")
        val candidate = File(requested)
        // A link at the path is refused even when it points at the right place; a missing
        // folder is fine (the sweep creates it), anything else there is not.
        when (entryKind(candidate)) {
            EntryKind.DIRECTORY, EntryKind.MISSING -> Unit
            EntryKind.LINK, EntryKind.OTHER -> throw BackupContainer.StagingException("not a directory")
        }
        val expected = File(cacheDir.canonicalFile, name)
        if (candidate.canonicalPath != expected.path) {
            throw BackupContainer.StagingException("not the app's $name cache folder")
        }
        return expected
    }

    /**
     * Empties the staging directory, creating it if needed. Backup and restore plaintext only ever lives there,
     * so one sweep is the whole cleanup after a crash. Throws when the folder cannot be created or
     * something in it could not be removed: staging must not start next to leftover plaintext.
     */
    fun sweep(dir: File) {
        when (entryKind(dir)) {
            EntryKind.DIRECTORY -> Unit
            EntryKind.MISSING -> if (!dir.mkdirs()) throw BackupContainer.StagingException("cannot be created")
            EntryKind.LINK, EntryKind.OTHER -> throw BackupContainer.StagingException("cannot be created")
        }
        // A folder that cannot be listed may still hold plaintext, so it fails like one that cannot be emptied.
        val children = dir.listFiles() ?: throw BackupContainer.StagingException("could not be emptied")
        var emptied = true
        children.forEach { if (!removeTree(it)) emptied = false }
        if (!emptied) throw BackupContainer.StagingException("could not be emptied")
    }

    /**
     * Deletes a tree without following symbolic links, so a link planted in staging cannot pull in
     * its target: only a real directory is recursed into, and `File.delete` unlinks a link entry
     * itself. Returns false if anything is still there afterwards.
     */
    private fun removeTree(file: File): Boolean {
        var removed = true
        if (entryKind(file) == EntryKind.DIRECTORY) {
            file.listFiles()?.forEach { if (!removeTree(it)) removed = false }
        }
        return (file.delete() || entryKind(file) == EntryKind.MISSING) && removed
    }

    /**
     * Removes [requested] for the app's cache sweeps without following symbolic links (see
     * [removeTree]). Its parent is canonicalised and must lie inside one of [roots], so neither
     * `..` nor a linked ancestor can carry the removal out of them. Each of [exact] also
     * qualifies, but only itself: the same name directly inside its canonical parent, never an
     * entry below it, so a link planted in its place is unlinked and its target left alone. A
     * missing entry is fine.
     */
    fun removeNoFollow(requested: String, roots: List<File>, exact: List<File> = emptyList()) {
        if (!requested.startsWith("/")) throw BackupContainer.RemovalException("not an absolute path")
        val file = File(requested)
        val name = file.name
        val parent = file.parentFile ?: throw BackupContainer.RemovalException("not inside the app's cache")
        if (name.isEmpty() || name == "." || name == "..") {
            throw BackupContainer.RemovalException("not a single name")
        }
        val canonicalParent = parent.canonicalFile
        val inside = roots.any { root ->
            val base = root.canonicalPath
            canonicalParent.path == base || canonicalParent.path.startsWith("$base/")
        }
        val named = exact.any { allowed ->
            val allowedParent = allowed.parentFile ?: return@any false
            allowed.name == name && canonicalParent.path == allowedParent.canonicalPath
        }
        if (!inside && !named) throw BackupContainer.RemovalException("not inside the app's cache")
        if (!removeTree(File(canonicalParent, name))) {
            throw BackupContainer.RemovalException("could not be removed")
        }
    }
}
