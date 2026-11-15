import CryptoKit
import Foundation
import LocalAuthentication

enum SealedKeyError: LocalizedError, Equatable {
  /// The stored item is not an SVK1 container this code can read.
  case corrupt(String)
  /// The Secure Enclave refused the operation: a cancelled prompt, a locked
  /// device, or a key the enclave no longer holds.
  case enclave(String)

  var errorDescription: String? {
    switch self {
    case .corrupt(let detail): return "The sealed vault key is damaged (\(detail))."
    case .enclave(let detail): return "The Secure Enclave did not open the vault key: \(detail)"
    }
  }
}

/// SVK1: the vault key sealed to a P-256 key that lives in the Secure Enclave.
///
/// The enclave cannot hold an AES key, so the vault key is wrapped with ECIES:
/// a fresh ephemeral P-256 key agrees with the enclave key's public half,
/// HKDF-SHA256 turns the shared secret into a wrapping key, and AES-256-GCM
/// seals the 32-byte vault key. Opening it needs the enclave to run the key
/// agreement, which only this device's enclave can do, and only after the
/// user-presence check bound to the enclave key.
///
/// Layout, one Keychain item:
///
///     "SVK1" | u16 BE length | enclave key blob | ephemeral public key (X9.63, 65 bytes)
///            | AES-GCM nonce (12) | sealed vault key (32) | tag (16)
///
/// The enclave key blob is the enclave's own encrypted handle to the private
/// key; it means nothing on another device. The magic and the ephemeral key
/// are authenticated as additional data.
enum SealedKey {
  static let magic = Data("SVK1".utf8)
  static let vaultKeyBytes = 32
  private static let publicKeyBytes = 65
  private static let sealedBytes = 12 + vaultKeyBytes + 16
  private static let info = Data("SecureVault SVK1 vault key".utf8)

  /// Seals `vaultKey` to `recipient`, carrying `enclaveKey` (the recipient's
  /// enclave blob) so one item holds everything `open` needs.
  static func seal(_ vaultKey: SymmetricKey, to recipient: P256.KeyAgreement.PublicKey, enclaveKey: Data) throws -> Data {
    guard vaultKey.bitCount == vaultKeyBytes * 8 else { throw SealedKeyError.corrupt("vault key size") }
    guard !enclaveKey.isEmpty, enclaveKey.count <= Int(UInt16.max) else { throw SealedKeyError.corrupt("enclave key size") }
    let ephemeral = P256.KeyAgreement.PrivateKey()
    let ephemeralPublic = ephemeral.publicKey.x963Representation
    let wrapping = wrappingKey(try ephemeral.sharedSecretFromKeyAgreement(with: recipient), ephemeralPublic: ephemeralPublic)
    let plain = vaultKey.withUnsafeBytes { Data($0) }
    guard let sealed = try AES.GCM.seal(plain, using: wrapping, authenticating: magic + ephemeralPublic).combined else {
      throw SealedKeyError.corrupt("seal")
    }

    var out = magic
    out.append(UInt8(enclaveKey.count >> 8))
    out.append(UInt8(enclaveKey.count & 0xff))
    out.append(enclaveKey)
    out.append(ephemeralPublic)
    out.append(sealed)
    return out
  }

  /// The parts of an SVK1 item, checked for shape only.
  struct Parts {
    let enclaveKey: Data
    let ephemeral: P256.KeyAgreement.PublicKey
    let ephemeralPublic: Data
    let sealed: Data
  }

  static func parse(_ data: Data) throws -> Parts {
    let bytes = [UInt8](data)
    guard bytes.count > 6, Data(bytes[0..<4]) == magic else { throw SealedKeyError.corrupt("magic") }
    let length = Int(bytes[4]) << 8 | Int(bytes[5])
    guard length > 0, bytes.count == 6 + length + publicKeyBytes + sealedBytes else {
      throw SealedKeyError.corrupt("length")
    }
    let enclaveKey = Data(bytes[6..<(6 + length)])
    let publicStart = 6 + length
    let ephemeralPublic = Data(bytes[publicStart..<(publicStart + publicKeyBytes)])
    let sealed = Data(bytes[(publicStart + publicKeyBytes)...])
    let ephemeral: P256.KeyAgreement.PublicKey
    do {
      ephemeral = try P256.KeyAgreement.PublicKey(x963Representation: ephemeralPublic)
    } catch {
      throw SealedKeyError.corrupt("ephemeral key")
    }
    return Parts(enclaveKey: enclaveKey, ephemeral: ephemeral, ephemeralPublic: ephemeralPublic, sealed: sealed)
  }

  /// Opens an SVK1 item. `agree` runs the key agreement with the private key
  /// the item names; for the app that is the Secure Enclave.
  static func open(
    _ data: Data,
    agree: (_ enclaveKey: Data, _ ephemeral: P256.KeyAgreement.PublicKey) throws -> SharedSecret
  ) throws -> SymmetricKey {
    let parts = try parse(data)
    let wrapping = wrappingKey(try agree(parts.enclaveKey, parts.ephemeral), ephemeralPublic: parts.ephemeralPublic)
    let plain: Data
    do {
      plain = try AES.GCM.open(AES.GCM.SealedBox(combined: parts.sealed), using: wrapping, authenticating: magic + parts.ephemeralPublic)
    } catch {
      throw SealedKeyError.corrupt("authentication")
    }
    return SymmetricKey(data: plain)
  }

  private static func wrappingKey(_ secret: SharedSecret, ephemeralPublic: Data) -> SymmetricKey {
    secret.hkdfDerivedSymmetricKey(using: SHA256.self, salt: ephemeralPublic, sharedInfo: info, outputByteCount: 32)
  }
}

/// The Secure Enclave side of SVK1. Unavailable on the simulator and on
/// devices without an enclave; callers then keep the plain Keychain item.
enum EnclaveKey {
  static var isAvailable: Bool { SecureEnclave.isAvailable }

  /// Creates an enclave key under `accessControl` and seals `vaultKey` to it.
  static func seal(_ vaultKey: SymmetricKey, accessControl: SecAccessControl) throws -> Data {
    let key: SecureEnclave.P256.KeyAgreement.PrivateKey
    do {
      key = try SecureEnclave.P256.KeyAgreement.PrivateKey(accessControl: accessControl)
    } catch {
      throw SealedKeyError.enclave(error.localizedDescription)
    }
    return try SealedKey.seal(vaultKey, to: key.publicKey, enclaveKey: key.dataRepresentation)
  }

  /// Opens a sealed vault key. With an evaluated `context` the enclave asks
  /// nothing; with a fresh one it shows the user-presence prompt once.
  static func open(_ sealed: Data, context: LAContext?) throws -> SymmetricKey {
    try SealedKey.open(sealed) { enclaveKey, ephemeral in
      do {
        let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(
          dataRepresentation: enclaveKey, authenticationContext: context
        )
        return try key.sharedSecretFromKeyAgreement(with: ephemeral)
      } catch {
        throw SealedKeyError.enclave(error.localizedDescription)
      }
    }
  }
}
