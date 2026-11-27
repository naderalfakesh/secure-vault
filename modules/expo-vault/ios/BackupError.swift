import Foundation

enum BackupError: LocalizedError {
  case corrupt(String)
  case passphrase
  case unsupported(String)
  case resource(String)
  case noSpace(needed: Int64, available: Int64)
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
