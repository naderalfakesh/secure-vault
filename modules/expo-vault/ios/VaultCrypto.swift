import CryptoKit
import Foundation
import ImageIO
import UIKit

/// Streaming AES-256-GCM container shared with the Android implementation.
///
/// Layout: magic "SVC1", chunk size (UInt32 BE), then per chunk a UInt32 BE
/// length followed by nonce (12) + ciphertext + tag (16). The chunk index is
/// the only additional authenticated data: an altered or repositioned chunk
/// fails its tag. There is no end marker, so a stream cut on a chunk boundary
/// reads as a shorter file, and a same-index chunk from another file under the
/// same key is not detected. Files written by the 2025 prototype are a single
/// CryptoKit sealed box with no header and are still readable.
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

  /// A failed encryption leaves no partial ciphertext at `destination`.
  static func encryptFile(from source: URL, to destination: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    try encrypt(input, to: destination, key: key)
  }

  /// Reads `input` to its end in chunks and writes the container to
  /// `destination`. Every read and write is a throwing call, so an I/O error
  /// is a Swift error rather than an Objective-C exception, and whatever was
  /// written before it is removed.
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

  /// A failed decryption leaves no partial plaintext at `destination`.
  static func decryptFile(from source: URL, to destination: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try read(input, count: magic.count)
    guard header == magic else {
      // Legacy single sealed box.
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

  /// Authenticates every chunk and keeps none of the plaintext, so a damaged
  /// file is found without writing anything.
  static func verifyFile(at source: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    guard try read(input, count: magic.count) == magic else {
      // Legacy single sealed box.
      let box = try AES.GCM.SealedBox(combined: try Data(contentsOf: source))
      _ = try AES.GCM.open(box, using: key)
      return
    }
    try openChunks(input, key: key) { _ in }
  }

  /// Reads the chunk size after the magic, then opens the chunks in order,
  /// each bound to its index, and passes every plaintext to `sink`. Every
  /// length is checked against the bytes left in the file before it is read.
  private static func openChunks(_ input: FileHandle, key: SymmetricKey, sink: (Data) throws -> Void) throws {
    guard try read(input, count: 4).count == 4 else { throw CryptoError.corrupt("header") } // chunk size, informational
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

  /// The plaintext passes through a `thumb_` file in Caches, a name the app's
  /// lock and launch sweep removes, so a kill mid-write leaves nothing in tmp.
  static func encryptData(_ data: Data, to destination: URL, key: SymmetricKey) throws {
    let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let temp = caches.appendingPathComponent("thumb_encrypt_\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: temp) }
    try data.write(to: temp)
    try encryptFile(from: temp, to: destination, key: key)
  }

  /// Downsampled JPEG for list thumbnails; orientation is applied so the
  /// thumbnail matches the photo the user took.
  static func thumbnailJPEG(from source: URL, maxPixelSize: Int) throws -> Data {
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
      kCGImageSourceShouldCache: false,
    ]
    guard let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil),
      let cgImage = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, options as CFDictionary),
      let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.8)
    else {
      throw CryptoError.corrupt("thumbnail")
    }
    return jpeg
  }

  private static func be32(_ value: UInt32) -> Data {
    var big = value.bigEndian
    return Data(bytes: &big, count: 4)
  }

  /// Throwing read: unlike `readData(ofLength:)`, an I/O error is a Swift
  /// error the caller can catch. Returns fewer bytes only at the end of the file.
  static func read(_ input: FileHandle, count: Int) throws -> Data {
    try input.read(upToCount: count) ?? Data()
  }

  private static func readBe32(_ data: Data) -> UInt32 {
    data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
  }
}
