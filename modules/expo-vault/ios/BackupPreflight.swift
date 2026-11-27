import Foundation
import os

extension BackupContainer {
  typealias MemoryProbe = () -> Int?

  /// What the process may still allocate before the OS ends it, or nil when
  /// the OS gives no figure (`os_proc_available_memory` returns 0 outside an
  /// app process with a memory limit). A trial allocation is not used on iOS:
  /// a successful `malloc` does not mean the pages can be touched before the
  /// process is killed.
  static func availableMemory() -> Int? {
    #if os(iOS)
      let available = os_proc_available_memory()
      return available > 0 ? available : nil
    #else
      // macOS, where the format tests run, has no per-process memory limit to ask.
      return nil
    #endif
  }

  /// Refuses a declared length whose decoding would need more memory than the
  /// OS says is left. Unknown memory (no figure from the OS) is not a refusal.
  static func ensureMemory(for length: Int, memory: MemoryProbe, what: String) throws {
    guard let available = memory() else { return }
    let (needed, overflow) = length.multipliedReportingOverflow(by: jsonCopies)
    if overflow || needed > available { throw BackupError.resource(what) }
  }

  /// What the restore pass needs, worked out from the pre-pass before anything is removed.
  struct RestoreNeeds {
    /// Upper bound of the largest `s` plaintext, which the restore pass holds in memory whole.
    var largestString: UInt64
    /// Bytes the restored vault, extras and the restore pass's temporary files can take at their peak.
    var disk: UInt64
    /// Bytes the restore pass writes before the old vault is removed: the first restored entry's
    /// payload copy and its plaintext, at most twice its payload. They need free space of their own.
    var scratch: UInt64
  }

  /// Every payload is re-encrypted into the vault (or moved out as an extra)
  /// at about its own size, and at the peak one entry's payload copy and
  /// plaintext sit in staging next to it; only the first restored entry's
  /// two files exist before the old vault is removed. The index extra is counted twice:
  /// JavaScript moves it into the SQLite folder after the native restore, and
  /// its first open writes a WAL beside it while the old index is still there.
  /// Each length is already bounded by the bytes left in the file, so the sums
  /// fit 64 bits. An `s` plaintext is at most its payload minus the stream header.
  static func restoreNeeds(_ layout: [EntryInfo]) -> RestoreNeeds {
    var total: UInt64 = 0
    var largest: UInt64 = 0
    var largestString: UInt64 = 0
    var index: UInt64 = 0
    var first: UInt64?
    for entry in layout where entry.meta.kind != "c" {
      if first == nil { first = entry.payloadLength }
      total += entry.payloadLength
      largest = max(largest, entry.payloadLength)
      if entry.meta.kind == "s" {
        largestString = max(
          largestString,
          entry.payloadLength > streamHeaderBytes ? entry.payloadLength - streamHeaderBytes : 0
        )
      }
      if entry.meta.kind == "x" && entry.meta.key == "database" { index += entry.payloadLength }
    }
    return RestoreNeeds(
      largestString: largestString,
      disk: total + 2 * largest + index,
      scratch: 2 * (first ?? 0)
    )
  }

  /// Refuses an `s` entry whose `copies` whole copies would not fit in the
  /// memory the OS says is left. Unknown memory is not a refusal. This lowers
  /// the chance of the OS ending the restore after the wipe but cannot rule it
  /// out, because memory pressure can rise during the pass.
  static func checkMemory(bytes: UInt64, copies: Int, available: Int?) throws {
    guard bytes > 0, let available else { return }
    let (needed, overflow) = bytes.multipliedReportingOverflow(by: UInt64(copies))
    if overflow || needed > UInt64(max(0, available)) {
      throw BackupError.resource("an entry of \(bytes) bytes")
    }
  }

  /// The restore needs `needed` bytes; `free` are free now and the wipe gives
  /// back `freed` (the old vault's entries). `scratch` of them are written
  /// before the wipe, so they must fit in `free` alone. No margin is added: a
  /// device that fills up during the pass still ends as a partial restore.
  static func checkSpace(needed: UInt64, scratch: UInt64, free: UInt64, freed: UInt64) throws {
    if scratch > free {
      throw BackupError.noSpace(needed: Int64(clamping: scratch), available: Int64(clamping: free))
    }
    let available = free &+ freed
    if needed > available {
      throw BackupError.noSpace(needed: Int64(clamping: needed), available: Int64(clamping: available))
    }
  }
}
