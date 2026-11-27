package expo.modules.vault

import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import java.io.File

internal object BackupStaging {
    private enum class EntryKind { MISSING, DIRECTORY, LINK, OTHER }

    /** Uses Os.lstat (API 21+, unlike java.nio.file API 26+) so symlinks are never followed. */
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

    fun sweep(dir: File) {
        when (entryKind(dir)) {
            EntryKind.DIRECTORY -> Unit
            EntryKind.MISSING -> if (!dir.mkdirs()) throw BackupContainer.StagingException("cannot be created")
            EntryKind.LINK, EntryKind.OTHER -> throw BackupContainer.StagingException("cannot be created")
        }
        val children = dir.listFiles() ?: throw BackupContainer.StagingException("could not be emptied")
        var emptied = true
        children.forEach { if (!removeTree(it)) emptied = false }
        if (!emptied) throw BackupContainer.StagingException("could not be emptied")
    }

    /** Unlinks symlinks without recursing into their targets. */
    private fun removeTree(file: File): Boolean {
        var removed = true
        if (entryKind(file) == EntryKind.DIRECTORY) {
            file.listFiles()?.forEach { if (!removeTree(it)) removed = false }
        }
        return (file.delete() || entryKind(file) == EntryKind.MISSING) && removed
    }

    /** Canonicalises parent against roots/exact and unlinks target without following symlinks. */
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
