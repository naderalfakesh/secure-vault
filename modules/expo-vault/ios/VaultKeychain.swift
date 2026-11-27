import CryptoKit
import Foundation
import LocalAuthentication
import Security

enum VaultKeyError: LocalizedError {
  case invalid(String)
  case missing
  case keychain(OSStatus)
  case sealed(SealedKeyError)

  var errorDescription: String? {
    switch self {
    case .invalid(let key): return "Invalid vault key: \(key)"
    case .missing: return "Vault key not found. Create the vault first."
    case .keychain(let status):
      return "The vault key could not be read from the keychain: \(VaultKeychain.describe(status))"
    case .sealed(let error): return error.localizedDescription
    }
  }
}

enum VaultKeychain {
  static let account = "encryptionKey"
  static let sealedAccount = "sealedKey"

  enum Protection: String {
    case secureEnclave = "secure-enclave"
    case keychain
    case none
  }

  static func loadKey(service: String, context: LAContext) throws -> SymmetricKey {
    if let sealed = try sealedItem(service: service) {
      let key: SymmetricKey
      do {
        key = try EnclaveKey.open(sealed, context: context)
      } catch let error as SealedKeyError {
        throw VaultKeyError.sealed(error)
      }
      // Clean up plain item left by an interrupted migration.
      deleteItem(service: service, account: account)
      return key
    }
    let key = try plainKey(service: service, context: context)
    seal(key, service: service, context: context)
    return key
  }

  static func storeNewKey(_ key: SymmetricKey, service: String) throws {
    deleteItem(service: service, account: account)
    deleteItem(service: service, account: sealedAccount)
    if EnclaveKey.isAvailable, let access = enclaveAccess() {
      do {
        try addItem(service: service, account: sealedAccount, data: EnclaveKey.seal(key, accessControl: access), access: nil)
        return
      } catch {
        NSLog("[ExpoVault] Secure Enclave key not created, using the Keychain item: \(error.localizedDescription)")
      }
    }
    guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .userPresence, nil) else {
      throw VaultKeyError.keychain(errSecParam)
    }
    try addItem(service: service, account: account, data: key.withUnsafeBytes { Data($0) }, access: access)
  }

  static func protection(service: String) -> Protection {
    if exists(service: service, account: sealedAccount) { return .secureEnclave }
    if exists(service: service, account: account) { return .keychain }
    return .none
  }

  static func describe(_ status: OSStatus) -> String {
    let text = (SecCopyErrorMessageString(status, nil) as String?) ?? "Unknown keychain error."
    return "\(text) (\(status))"
  }

  /// Best-effort migration: verify the sealed item opens before deleting the plain key.
  private static func seal(_ key: SymmetricKey, service: String, context: LAContext) {
    guard EnclaveKey.isAvailable, let access = enclaveAccess() else { return }
    do {
      let sealed = try EnclaveKey.seal(key, accessControl: access)
      deleteItem(service: service, account: sealedAccount)
      try addItem(service: service, account: sealedAccount, data: sealed, access: nil)
      let opened = try EnclaveKey.open(sealed, context: context)
      guard opened == key else {
        deleteItem(service: service, account: sealedAccount)
        return
      }
      deleteItem(service: service, account: account)
    } catch {
      deleteItem(service: service, account: sealedAccount)
      NSLog("[ExpoVault] Vault key not moved to the Secure Enclave: \(error.localizedDescription)")
    }
  }

  private static func enclaveAccess() -> SecAccessControl? {
    SecAccessControlCreateWithFlags(
      nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil
    )
  }

  private static func plainKey(service: String, context: LAContext) throws -> SymmetricKey {
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

  /// No Keychain ACL so reading never prompts; the enclave key enforces user presence.
  private static func sealedItem(service: String) throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: sealedAccount,
      kSecAttrService as String: service,
      kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    switch status {
    case errSecSuccess:
      guard let data = item as? Data, !data.isEmpty else { throw VaultKeyError.keychain(errSecDecode) }
      return data
    case errSecItemNotFound:
      return nil
    default:
      throw VaultKeyError.keychain(status)
    }
  }

  private static func addItem(service: String, account: String, data: Data, access: SecAccessControl?) throws {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecValueData as String: data,
    ]
    if let access {
      query[kSecAttrAccessControl as String] = access
    } else {
      query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    }
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else { throw VaultKeyError.keychain(status) }
  }

  private static func deleteItem(service: String, account: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
    ]
    SecItemDelete(query as CFDictionary)
  }

  private static func exists(service: String, account: String) -> Bool {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecReturnData as String: false,
      kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
    ]
    // Access-controlled items return errSecInteractionNotAllowed; only errSecItemNotFound means absent.
    return SecItemCopyMatching(query as CFDictionary, nil) != errSecItemNotFound
  }
}

/// Caches the unlocked session's LAContext and key so subsequent reads do not re-prompt.
final class VaultKeySession {
  private let lock = NSLock()
  private var context: LAContext?
  private var key: SymmetricKey?

  func current() -> LAContext {
    lock.lock()
    defer { lock.unlock() }
    if let context { return context }
    let fresh = LAContext()
    context = fresh
    return fresh
  }

  func key(for context: LAContext) -> SymmetricKey? {
    lock.lock()
    defer { lock.unlock() }
    return self.context === context ? key : nil
  }

  func remember(_ key: SymmetricKey, for context: LAContext) {
    lock.lock()
    if self.context === context { self.key = key }
    lock.unlock()
  }

  func adopt(_ context: LAContext) {
    lock.lock()
    let previous = self.context
    self.context = context
    key = nil
    lock.unlock()
    if previous !== context { previous?.invalidate() }
  }

  func discard(_ context: LAContext) {
    lock.lock()
    if self.context === context {
      self.context = nil
      key = nil
    }
    lock.unlock()
    context.invalidate()
  }

  func end() {
    lock.lock()
    let previous = context
    context = nil
    key = nil
    lock.unlock()
    previous?.invalidate()
  }
}
