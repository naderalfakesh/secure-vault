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
  /// The Secure Enclave did not open the sealed key, or the item is damaged.
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

/// The device key's keychain items. Every status the keychain returns becomes
/// a typed error with the system's own wording, so a locked device, a
/// cancelled prompt or a missing item is reported as what it is rather than
/// as a bare number.
///
/// Two forms exist (ADR 0009):
/// - `sealedKey`: the vault key sealed to a Secure Enclave key (SVK1). The
///   item itself has no access control; the enclave key does, so opening it
///   needs this device's enclave and the user's presence.
/// - `encryptionKey`: the vault key as a Keychain item guarded by
///   `.userPresence`. Vaults created before the enclave, and devices without
///   one (the simulator), use it. The first unlock on a device with an
///   enclave seals it and removes it.
enum VaultKeychain {
  static let account = "encryptionKey"
  static let sealedAccount = "sealedKey"

  /// How the key is protected, for Settings and diagnostics.
  enum Protection: String {
    case secureEnclave = "secure-enclave"
    case keychain
    case none
  }

  /// Reads the key with `context`. A context that has already been
  /// evaluated opens the key without another prompt; an unevaluated one
  /// shows the prompt once and is authenticated afterwards, so every later
  /// read with the same context is silent too.
  static func loadKey(service: String, context: LAContext) throws -> SymmetricKey {
    if let sealed = try sealedItem(service: service) {
      let key: SymmetricKey
      do {
        key = try EnclaveKey.open(sealed, context: context)
      } catch let error as SealedKeyError {
        throw VaultKeyError.sealed(error)
      }
      // A plain item next to a sealed one is what an interrupted move leaves.
      deleteItem(service: service, account: account)
      return key
    }
    let key = try plainKey(service: service, context: context)
    seal(key, service: service, context: context)
    return key
  }

  /// Stores a new vault key: sealed when the device has an enclave, as a
  /// plain item otherwise. Replaces whatever the service held.
  static func storeNewKey(_ key: SymmetricKey, service: String) throws {
    deleteItem(service: service, account: account)
    deleteItem(service: service, account: sealedAccount)
    if EnclaveKey.isAvailable, let access = enclaveAccess() {
      do {
        try addItem(service: service, account: sealedAccount, data: EnclaveKey.seal(key, accessControl: access), access: nil)
        return
      } catch {
        // An enclave that refuses to create a key leaves the plain item as the fallback.
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

  /// The system's sentence for a status, followed by the number for logs.
  static func describe(_ status: OSStatus) -> String {
    let text = (SecCopyErrorMessageString(status, nil) as String?) ?? "Unknown keychain error."
    return "\(text) (\(status))"
  }

  // MARK: - Moving a plain key into the enclave

  /// Seals a plain key that `context` just opened, then removes the plain
  /// item. Best effort: any failure keeps the plain item, and the vault
  /// works as before. The sealed item is written and opened with the same
  /// context before the plain one goes, so a crash at any point leaves at
  /// least one item that opens.
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

  /// The enclave key's access control: usable only while the device is
  /// unlocked, never leaves it, and asks for Face ID, Touch ID or the device
  /// passcode, like the plain item's `.userPresence`.
  private static func enclaveAccess() -> SecAccessControl? {
    SecAccessControlCreateWithFlags(
      nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil
    )
  }

  // MARK: - Items

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

  /// The sealed item has no access control, so reading it never prompts.
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

  /// Deleting an access-controlled item needs no authentication, so this never prompts.
  private static func deleteItem(service: String, account: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
    ]
    SecItemDelete(query as CFDictionary)
  }

  /// Whether the item exists, without reading it or prompting.
  private static func exists(service: String, account: String) -> Bool {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecReturnData as String: false,
      kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
    ]
    // An access-controlled item answers "interaction required" without its
    // data; only "not found" means it is missing.
    return SecItemCopyMatching(query as CFDictionary, nil) != errSecItemNotFound
  }
}

/// The authenticated `LAContext` of the unlocked session, and the key it
/// opened. The device key is guarded by user presence, and without a context
/// every read shows its own Face ID or passcode prompt: one at unlock, then
/// one per thumbnail. The session keeps the context it unlocked with and the
/// key that context opened, so later reads neither prompt nor go back to the
/// Keychain or the Secure Enclave; locking the vault drops both, so the next
/// read prompts again. Reads run on the vault queue and the unlock prompt
/// answers on a queue of its own, so access is locked.
final class VaultKeySession {
  private let lock = NSLock()
  private var context: LAContext?
  private var key: SymmetricKey?

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

  /// The key `context` opened, while it is still the session's context.
  func key(for context: LAContext) -> SymmetricKey? {
    lock.lock()
    defer { lock.unlock() }
    return self.context === context ? key : nil
  }

  /// Keeps the key `context` opened, unless the session moved on meanwhile.
  func remember(_ key: SymmetricKey, for context: LAContext) {
    lock.lock()
    if self.context === context { self.key = key }
    lock.unlock()
  }

  /// Makes `context`, just evaluated by the unlock prompt, the session's.
  func adopt(_ context: LAContext) {
    lock.lock()
    let previous = self.context
    self.context = context
    key = nil
    lock.unlock()
    if previous !== context { previous?.invalidate() }
  }

  /// Drops a context that did not open the key, so a cancelled prompt is not
  /// remembered as the session's and the next read asks again.
  func discard(_ context: LAContext) {
    lock.lock()
    if self.context === context {
      self.context = nil
      key = nil
    }
    lock.unlock()
    context.invalidate()
  }

  /// Ends the session: the next key read prompts.
  func end() {
    lock.lock()
    let previous = context
    context = nil
    key = nil
    lock.unlock()
    previous?.invalidate()
  }
}
