import CryptoKit
import Foundation
import Security
import XCTest

@testable import VaultFormats

/// SVK1, the vault key sealed to a Secure Enclave key. The format tests use a
/// software P-256 key in the enclave's place; the last test uses this Mac's
/// own Secure Enclave when it has one.
final class SealedKeyTests: XCTestCase {
  private let recipient = P256.KeyAgreement.PrivateKey()
  private let blob = Data("enclave-handle".utf8)

  private func open(_ sealed: Data, with key: P256.KeyAgreement.PrivateKey? = nil) throws -> SymmetricKey {
    try SealedKey.open(sealed) { enclaveKey, ephemeral in
      XCTAssertEqual(enclaveKey, self.blob)
      return try (key ?? self.recipient).sharedSecretFromKeyAgreement(with: ephemeral)
    }
  }

  private func bytes(_ key: SymmetricKey) -> Data { key.withUnsafeBytes { Data($0) } }

  func testRoundTripsTheVaultKey() throws {
    let vaultKey = SymmetricKey(size: .bits256)
    let sealed = try SealedKey.seal(vaultKey, to: recipient.publicKey, enclaveKey: blob)

    XCTAssertEqual(sealed.prefix(4), SealedKey.magic)
    XCTAssertEqual(sealed.count, 4 + 2 + blob.count + 65 + 12 + 32 + 16)
    XCTAssertNil(sealed.range(of: bytes(vaultKey)), "the vault key must not appear in the clear")
    XCTAssertEqual(bytes(try open(sealed)), bytes(vaultKey))
  }

  func testEverySealUsesAFreshEphemeralKey() throws {
    let vaultKey = SymmetricKey(size: .bits256)
    let first = try SealedKey.seal(vaultKey, to: recipient.publicKey, enclaveKey: blob)
    let second = try SealedKey.seal(vaultKey, to: recipient.publicKey, enclaveKey: blob)
    XCTAssertNotEqual(first, second)
  }

  func testRefusesAnotherRecipient() throws {
    let sealed = try SealedKey.seal(SymmetricKey(size: .bits256), to: recipient.publicKey, enclaveKey: blob)
    XCTAssertThrowsError(try open(sealed, with: P256.KeyAgreement.PrivateKey())) { error in
      XCTAssertEqual(error as? SealedKeyError, .corrupt("authentication"))
    }
  }

  func testRefusesEveryAlteredByteAfterTheHeader() throws {
    let sealed = try SealedKey.seal(SymmetricKey(size: .bits256), to: recipient.publicKey, enclaveKey: blob)
    // The enclave blob is checked by the enclave itself; the test double ignores it.
    let firstChecked = 6 + blob.count
    for index in firstChecked..<sealed.count {
      var altered = sealed
      altered[index] ^= 0x01
      XCTAssertThrowsError(try open(altered), "byte \(index)")
    }
  }

  func testRefusesBadShapes() throws {
    let sealed = try SealedKey.seal(SymmetricKey(size: .bits256), to: recipient.publicKey, enclaveKey: blob)
    var wrongMagic = sealed
    wrongMagic[0] = UInt8(ascii: "X")
    XCTAssertThrowsError(try SealedKey.parse(wrongMagic)) { XCTAssertEqual($0 as? SealedKeyError, .corrupt("magic")) }
    XCTAssertThrowsError(try SealedKey.parse(sealed.dropLast())) { XCTAssertEqual($0 as? SealedKeyError, .corrupt("length")) }
    XCTAssertThrowsError(try SealedKey.parse(sealed + Data([0]))) { XCTAssertEqual($0 as? SealedKeyError, .corrupt("length")) }
    XCTAssertThrowsError(try SealedKey.parse(Data())) { XCTAssertEqual($0 as? SealedKeyError, .corrupt("magic")) }
  }

  func testRefusesAKeyOfTheWrongSize() {
    XCTAssertThrowsError(try SealedKey.seal(SymmetricKey(size: .bits128), to: recipient.publicKey, enclaveKey: blob))
    XCTAssertThrowsError(try SealedKey.seal(SymmetricKey(size: .bits256), to: recipient.publicKey, enclaveKey: Data()))
  }

  /// The real enclave, without a user-presence flag so no prompt can appear.
  func testRoundTripsThroughThisMacsSecureEnclave() throws {
    try XCTSkipUnless(EnclaveKey.isAvailable, "no Secure Enclave on this machine")
    var error: Unmanaged<CFError>?
    let access = try XCTUnwrap(
      SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .privateKeyUsage, &error)
    )
    let vaultKey = SymmetricKey(size: .bits256)
    let sealed = try EnclaveKey.seal(vaultKey, accessControl: access)

    XCTAssertEqual(bytes(try EnclaveKey.open(sealed, context: nil)), bytes(vaultKey))

    var altered = sealed
    altered[altered.count - 1] ^= 0x01
    XCTAssertThrowsError(try EnclaveKey.open(altered, context: nil))
  }
}
