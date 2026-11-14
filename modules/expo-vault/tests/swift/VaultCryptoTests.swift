import CryptoKit
import Foundation
import XCTest

@testable import VaultFormats

/// SVC1, the chunked AES-256-GCM stream every vault file and backup payload uses.
final class VaultCryptoTests: XCTestCase {
  private var scratch: Scratch!

  override func setUpWithError() throws { scratch = try Scratch() }
  override func tearDown() { scratch.remove() }

  func testDecryptsEveryStreamVector() throws {
    for vector in Fixtures.vectors.streams {
      let output = scratch.file("plain-\(UUID().uuidString)")
      try VaultCrypto.decryptFile(from: Fixtures.url(vector.file), to: output, key: Fixtures.key)
      XCTAssertEqual(try Data(contentsOf: output), try Fixtures.data(vector.plaintext), vector.name)
      XCTAssertNoThrow(try VaultCrypto.verifyFile(at: Fixtures.url(vector.file), key: Fixtures.key), vector.name)
    }
  }

  func testRefusesEveryBrokenStreamAndLeavesNoPlaintext() throws {
    for vector in Fixtures.vectors.brokenStreams {
      let output = scratch.file("plain-\(UUID().uuidString)")
      XCTAssertThrowsError(
        try VaultCrypto.decryptFile(from: Fixtures.url(vector.file), to: output, key: Fixtures.key), vector.name
      )
      XCTAssertFalse(FileManager.default.fileExists(atPath: output.path), "\(vector.name) left plaintext behind")
      XCTAssertThrowsError(try VaultCrypto.verifyFile(at: Fixtures.url(vector.file), key: Fixtures.key), vector.name)
    }
  }

  func testRefusesTheRightStreamUnderAnotherKey() throws {
    let output = scratch.file("plain")
    XCTAssertThrowsError(
      try VaultCrypto.decryptFile(
        from: Fixtures.url("stream-multichunk.bin"), to: output, key: SymmetricKey(size: .bits256)
      )
    )
    XCTAssertFalse(FileManager.default.fileExists(atPath: output.path))
  }

  func testReadsTheSingleSealedBoxOfThe2025Prototype() throws {
    let vector = Fixtures.vectors.legacyApple
    let output = scratch.file("plain")
    try VaultCrypto.decryptFile(from: Fixtures.url(vector.file), to: output, key: Fixtures.key)
    XCTAssertEqual(try Data(contentsOf: output), try Fixtures.data(vector.plaintext))
  }

  /// Sizes around the 1 MiB chunk boundary, where an off-by-one would drop
  /// or repeat bytes.
  func testRoundTripsAcrossChunkBoundaries() throws {
    let chunk = VaultCrypto.chunkSize
    for size in [0, 1, chunk - 1, chunk, chunk + 1, 2 * chunk + 7] {
      let plain = Data.random(count: size)
      let source = scratch.file("source-\(size)")
      let sealed = scratch.file("sealed-\(size)")
      let opened = scratch.file("opened-\(size)")
      try plain.write(to: source)
      try VaultCrypto.encryptFile(from: source, to: sealed, key: Fixtures.key)
      try VaultCrypto.decryptFile(from: sealed, to: opened, key: Fixtures.key)
      XCTAssertEqual(try Data(contentsOf: opened), plain, "\(size) bytes")

      let bytes = try Data(contentsOf: sealed)
      let chunks = (size + chunk - 1) / chunk
      XCTAssertEqual(bytes.prefix(4), Data("SVC1".utf8))
      XCTAssertEqual(bytes.count, 8 + size + chunks * (4 + VaultCrypto.nonceSize + VaultCrypto.tagSize), "\(size) bytes")
    }
  }

  func testSealsTheSamePlaintextDifferentlyEachTime() throws {
    let source = scratch.file("source")
    try Data("same plaintext".utf8).write(to: source)
    let first = scratch.file("first")
    let second = scratch.file("second")
    try VaultCrypto.encryptFile(from: source, to: first, key: Fixtures.key)
    try VaultCrypto.encryptFile(from: source, to: second, key: Fixtures.key)
    XCTAssertNotEqual(try Data(contentsOf: first), try Data(contentsOf: second))
  }
}
