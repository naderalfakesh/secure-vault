import Foundation
import os

extension BackupContainer {
  typealias MemoryProbe = () -> Int?

  /// Uses os_proc_available_memory (0 when unlimited); malloc probes miss iOS Jetsam limits.
  static func availableMemory() -> Int? {
    #if os(iOS)
      let available = os_proc_available_memory()
      return available > 0 ? available : nil
    #else
      return nil
    #endif
  }

  static func ensureMemory(for length: Int, memory: MemoryProbe, what: String) throws {
    guard let available = memory() else { return }
    let (needed, overflow) = length.multipliedReportingOverflow(by: jsonCopies)
    if overflow || needed > available { throw BackupError.resource(what) }
  }

  struct RestoreNeeds {
    var largestString: UInt64
    var disk: UInt64
    var scratch: UInt64
  }

  /// Peak disk = total + 2*largest (staging payload+plain) + extra index copy (WAL during swap).
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

  static func checkMemory(bytes: UInt64, copies: Int, available: Int?) throws {
    guard bytes > 0, let available else { return }
    let (needed, overflow) = bytes.multipliedReportingOverflow(by: UInt64(copies))
    if overflow || needed > UInt64(max(0, available)) {
      throw BackupError.resource("an entry of \(bytes) bytes")
    }
  }

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
