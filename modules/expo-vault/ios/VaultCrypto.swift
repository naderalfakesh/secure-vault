import CryptoKit
import Foundation

/// Streaming AES-256-GCM ("SVC1" | be32 chunkSize | chunks of be32 len + 12B IV + ciphertext + 16B tag, AAD = be32 chunkIndex).
/// No end marker (chunk-boundary truncation reads shorter). Pre-SVC1 files are a single CryptoKit sealed box.
enum VaultCrypto {
  static let magic = Data("SVC1".utf8)
  static let chunkSize = 1_048_576
  static let nonceSize = 12
  static let tagSize = 16

  enum CryptoError: Error, LocalizedError {
    case corrupt(String)
    var errorDescription: String? {
      if case let .corrupt(reason) = self { return "Vault file is corrupt: \(reason)" }
      return nil
    }
  }

  static func encryptFile(from source: URL, to destination: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    try encrypt(input, to: destination, key: key)
  }

  static func encrypt(_ input: FileHandle, to destination: URL, key: SymmetricKey) throws {
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    do {
      let output = try FileHandle(forWritingTo: destination)
      defer { try? output.close() }
      try output.write(contentsOf: magic)
      try output.write(contentsOf: be32(UInt32(chunkSize)))
      var index: UInt32 = 0
      while true {
        let chunk = try read(input, count: chunkSize)
        if chunk.isEmpty { break }
        let sealed = try AES.GCM.seal(chunk, using: key, authenticating: be32(index))
        guard let combined = sealed.combined else { throw CryptoError.corrupt("seal") }
        try output.write(contentsOf: be32(UInt32(combined.count)))
        try output.write(contentsOf: combined)
        index += 1
      }
    } catch {
      try? FileManager.default.removeItem(at: destination)
      throw error
    }
  }

  static func decryptFile(from source: URL, to destination: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try read(input, count: magic.count)
    guard header == magic else {
      try? input.close()
      let sealedData = try Data(contentsOf: source)
      let box = try AES.GCM.SealedBox(combined: sealedData)
      let plain = try AES.GCM.open(box, using: key)
      try plain.write(to: destination, options: .atomic)
      return
    }

    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    do {
      let output = try FileHandle(forWritingTo: destination)
      defer { try? output.close() }
      try openChunks(input, key: key) { try output.write(contentsOf: $0) }
    } catch {
      try? FileManager.default.removeItem(at: destination)
      throw error
    }
  }

  static func verifyFile(at source: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    guard try read(input, count: magic.count) == magic else {
      let box = try AES.GCM.SealedBox(combined: try Data(contentsOf: source))
      _ = try AES.GCM.open(box, using: key)
      return
    }
    try openChunks(input, key: key) { _ in }
  }

  private static func openChunks(_ input: FileHandle, key: SymmetricKey, sink: (Data) throws -> Void) throws {
    guard try read(input, count: 4).count == 4 else { throw CryptoError.corrupt("header") }
    let start = try input.offset()
    let end = try input.seekToEnd()
    try input.seek(toOffset: start)
    var index: UInt32 = 0
    while true {
      let lengthData = try read(input, count: 4)
      if lengthData.isEmpty { break }
      guard lengthData.count == 4 else { throw CryptoError.corrupt("length") }
      let length = Int(readBe32(lengthData))
      let offset = try input.offset()
      guard length >= nonceSize + tagSize, offset <= end, UInt64(length) <= end - offset else {
        throw CryptoError.corrupt("chunk \(index)")
      }
      let combined = try read(input, count: length)
      guard combined.count == length else { throw CryptoError.corrupt("chunk \(index)") }
      let box = try AES.GCM.SealedBox(combined: combined)
      try sink(try AES.GCM.open(box, using: key, authenticating: be32(index)))
      index += 1
    }
  }

  /// Stages in Caches under a thumb_ prefix so the lock/launch sweep cleans up after a mid-write kill.
  static func encryptData(_ data: Data, to destination: URL, key: SymmetricKey) throws {
    let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let temp = caches.appendingPathComponent("thumb_encrypt_\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: temp) }
    try data.write(to: temp)
    try encryptFile(from: temp, to: destination, key: key)
  }

  private static func be32(_ value: UInt32) -> Data {
    var big = value.bigEndian
    return Data(bytes: &big, count: 4)
  }

  /// Uses throwing read(upToCount:) instead of readData(ofLength:) which raises uncatchable Obj-C exceptions.
  static func read(_ input: FileHandle, count: Int) throws -> Data {
    try input.read(upToCount: count) ?? Data()
  }

  private static func readBe32(_ data: Data) -> UInt32 {
    data.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).bigEndian }
  }
}
