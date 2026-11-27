package expo.modules.vault

internal object BackupPreflight {
    /** Peak disk = total + 2*largest (staging payload+plain) + extra index copy (WAL during swap). */
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

    /** Trial allocation forces GC before OOM; heap arithmetic would miscount garbage. */
    fun reserveMemory(bytes: Long, copies: Int) {
        if (bytes <= 0) return
        if (bytes > Int.MAX_VALUE - 8) throw BackupContainer.ResourceException("an entry of $bytes bytes")
        try {
            val held = Array(copies) { ByteArray(bytes.toInt()) }
            // Touch each array so the VM cannot elide the allocation.
            held.forEach { it[it.size - 1] = 1 }
        } catch (e: OutOfMemoryError) {
            throw BackupContainer.ResourceException("an entry of $bytes bytes")
        }
    }

    /** Exclude SecureVault's own cache (holds backup + staging) from StorageManager's allocatable bytes. */
    fun writableBytes(usable: Long, allocatable: Long?, ownCache: Long): Long {
        if (allocatable == null) return maxOf(0L, usable)
        return maxOf(0L, minOf(usable, allocatable - ownCache))
    }

    fun checkSpace(needed: Long, scratch: Long, free: Long, freed: Long) {
        if (scratch > free) throw BackupContainer.NoSpaceException(scratch, free)
        val available = free + freed
        if (needed > available) throw BackupContainer.NoSpaceException(needed, available)
    }
}
