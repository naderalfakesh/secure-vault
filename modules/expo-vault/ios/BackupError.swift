import Foundation

enum BackupError: LocalizedError {
  case corrupt(String)
  case passphrase
  /// A header setting no committed exporter writes: a newer format, or KDF or
  /// cipher settings outside the verified set.
  case unsupported(String)
  /// The device cannot hold what the restore needs in memory; raised before
  /// anything is removed.
  case resource(String)
  /// The restore needs more disk than is free plus what the old vault frees;
  /// raised before anything is removed.
  case noSpace(needed: Int64, available: Int64)
  /// The caller asked to stop while the restore was still checking; nothing
  /// was handled.
  case cancelled

  var errorDescription: String? {
    switch self {
    case .corrupt(let reason): return "The backup file is not valid: \(reason)"
    case .passphrase: return "That passphrase does not match this backup."
    case .unsupported(let reason):
      return "This backup uses settings this version of the app does not support: \(reason)."
    case .resource(let reason): return "This device does not have enough memory to restore this backup: \(reason)."
    case .noSpace(let needed, let available):
      return "This device does not have enough free space to restore this backup (needs \(needed) bytes, has \(available))."
    case .cancelled: return "The restore was cancelled before anything was changed."
    }
  }
}
