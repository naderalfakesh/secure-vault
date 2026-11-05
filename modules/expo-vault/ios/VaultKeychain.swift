import CryptoKit
import Foundation
import LocalAuthentication
import Security

enum VaultKeyError: LocalizedError {
  /// An entry name that fails the vault key grammar or path containment.
  case invalid(String)
  /// No device key in the keychain: the vault has not been created, or its key is gone.
  case missing
  /// The keychain refused to hand out the device key; the status says why.
  case keychain(OSStatus)

  var errorDescription: String? {
    switch self {
    case .invalid(let key): return "Invalid vault key: \(key)"
    case .missing: return "Vault key not found. Create the vault first."
    case .keychain(let status):
      return "The vault key could not be read from the keychain: \(VaultKeychain.describe(status))"
    }
  }
}

/// The device key's keychain item. Every status the keychain returns becomes
/// a typed error with the system's own wording, so a locked device, a
/// cancelled prompt or a missing item is reported as what it is rather than
/// as a bare number.
enum VaultKeychain {
  static let account = "encryptionKey"

  /// Reads the key with `context`. A context that has already been
  /// evaluated opens the item without another prompt; an unevaluated one
  /// shows the prompt once and is authenticated afterwards, so every later
  /// read with the same context is silent too.
  static func loadKey(service: String, context: LAContext) throws -> SymmetricKey {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecReturnData as String: true,
      kSecUseAuthenticationContext as String: context,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    switch status {
    case errSecSuccess:
      guard let data = item as? Data, !data.isEmpty else { throw VaultKeyError.keychain(errSecDecode) }
      return SymmetricKey(data: data)
    case errSecItemNotFound:
      throw VaultKeyError.missing
    default:
      throw VaultKeyError.keychain(status)
    }
  }

  /// The system's sentence for a status, followed by the number for logs.
  static func describe(_ status: OSStatus) -> String {
    let text = (SecCopyErrorMessageString(status, nil) as String?) ?? "Unknown keychain error."
    return "\(text) (\(status))"
  }
}

/// The authenticated `LAContext` of the unlocked session. The device key's
/// item is guarded by `.userPresence`, and without a context every keychain
/// read shows its own Face ID or passcode prompt: one at unlock, then one per
/// thumbnail. The session keeps the context it unlocked with and passes it to
/// every read; locking the vault invalidates it, so the next read prompts
/// again. Reads run on the vault queue and the unlock prompt answers on a
/// queue of its own, so access is locked.
final class VaultKeySession {
  private let lock = NSLock()
  private var context: LAContext?

  /// The session's context, or a fresh one that becomes the session's once a
  /// read through it has prompted.
  func current() -> LAContext {
    lock.lock()
    defer { lock.unlock() }
    if let context { return context }
    let fresh = LAContext()
    context = fresh
    return fresh
  }

  /// Makes `context`, just evaluated by the unlock prompt, the session's.
  func adopt(_ context: LAContext) {
    lock.lock()
    let previous = self.context
    self.context = context
    lock.unlock()
    if previous !== context { previous?.invalidate() }
  }

  /// Drops a context that did not open the key, so a cancelled prompt is not
  /// remembered as the session's and the next read asks again.
  func discard(_ context: LAContext) {
    lock.lock()
    if self.context === context { self.context = nil }
    lock.unlock()
    context.invalidate()
  }

  /// Ends the session: the next key read prompts.
  func end() {
    lock.lock()
    let previous = context
    context = nil
    lock.unlock()
    previous?.invalidate()
  }
}
