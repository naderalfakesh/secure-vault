import CryptoKit
import Foundation
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

  static func loadKey(service: String) throws -> SymmetricKey {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecReturnData as String: true,
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
