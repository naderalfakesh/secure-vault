package expo.modules.vault

internal object BackupPreflight {
    /**
     * Every payload is re-encrypted into the vault (or moved out as an extra) at about its own
     * size, and at the peak one entry's payload copy and plaintext sit in staging next to it.
     * Only the first restored entry's two files exist before the old vault is removed.
     * The index extra is counted twice: JavaScript moves it into the SQLite folder after the
     * native restore, and its first open writes a WAL beside it while the old index is still
     * there. Each length is already bounded by the bytes left in the file, so the sums fit a
     * Long. An `s` plaintext is at most its payload minus the stream header.
     */
    fun restoreNeeds(layout: List<BackupContainer.EntryInfo>): BackupContainer.RestoreNeeds {
        var total = 0L
        var largest = 0L
        var largestString = 0L
        var index = 0L
        var first: Long? = null
        for (entry in layout) {
            if (entry.meta.kind == "c") continue
            if (first == null) first = entry.payloadLength
            total += entry.payloadLength
            largest = maxOf(largest, entry.payloadLength)
            if (entry.meta.kind == "s") {
                largestString = maxOf(
                    largestString,
                    maxOf(0L, entry.payloadLength - BackupFormat.STREAM_HEADER_BYTES),
                )
            }
            if (entry.meta.kind == "x" && entry.meta.key == "database") index += entry.payloadLength
        }
        return BackupContainer.RestoreNeeds(largestString, total + 2 * largest + index, 2 * (first ?: 0L))
    }

    /**
     * Trial allocation for an `s` entry: [copies] arrays of [bytes] each are allocated and
     * dropped at once. The VM collects garbage before it throws, so this refuses only memory
     * the process really cannot get; heap arithmetic would count garbage as used. It lowers the
     * chance of a failure after the wipe but cannot rule one out, because memory can be taken
     * between this check and the restore pass.
     */
    fun reserveMemory(bytes: Long, copies: Int) {
        if (bytes <= 0) return
        // The largest array the VM can make; a longer plaintext can never be read whole.
        if (bytes > Int.MAX_VALUE - 8) throw BackupContainer.ResourceException("an entry of $bytes bytes")
        try {
            val held = Array(copies) { ByteArray(bytes.toInt()) }
            // Touch every array so the allocation cannot be dropped as unused.
            held.forEach { it[it.size - 1] = 1 }
        } catch (e: OutOfMemoryError) {
            throw BackupContainer.ResourceException("an entry of $bytes bytes")
        }
    }

    /**
     * What the restore may count as free: what is writable now ([usable]), and no more than
     * StorageManager's allocatable figure once SecureVault's own cache ([ownCache]) is taken out
     * of it. That figure leaves out the system's low-storage reserve and counts clearable
     * caches; ours holds the picked backup and the staging folders the restore reads, so it is
     * never counted as room. [allocatable] is null where there is no such figure.
     */
    fun writableBytes(usable: Long, allocatable: Long?, ownCache: Long): Long {
        if (allocatable == null) return maxOf(0L, usable)
        return maxOf(0L, minOf(usable, allocatable - ownCache))
    }

    /**
     * The restore needs [needed] bytes; [free] are free now and the wipe gives back [freed]
     * (the old vault's entries). [scratch] of them are written before the wipe, so they must fit
     * in [free] alone. No margin is added: the bound is the formula, and a device that fills up
     * during the pass still ends as a partial restore.
     */
    fun checkSpace(needed: Long, scratch: Long, free: Long, freed: Long) {
        if (scratch > free) throw BackupContainer.NoSpaceException(scratch, free)
        val available = free + freed
        if (needed > available) throw BackupContainer.NoSpaceException(needed, available)
    }
}
