import CryptoKit
import Foundation
import ImageIO
import UIKit

/// Streaming AES-256-GCM container shared with the Android implementation.
///
/// Layout: magic "SVC1", chunk size (UInt32 BE), then per chunk a UInt32 BE
/// length followed by nonce (12) + ciphertext + tag (16). The chunk index is
/// bound as additional authenticated data so chunks cannot be reordered or
/// dropped. Files written by the 2025 prototype are a single CryptoKit sealed
/// box with no header and are still readable.
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
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }

    output.write(magic)
    output.write(be32(UInt32(chunkSize)))
    var index: UInt32 = 0
    while true {
      let chunk = input.readData(ofLength: chunkSize)
      if chunk.isEmpty { break }
      let sealed = try AES.GCM.seal(chunk, using: key, authenticating: be32(index))
      guard let combined = sealed.combined else { throw CryptoError.corrupt("seal") }
      output.write(be32(UInt32(combined.count)))
      output.write(combined)
      index += 1
    }
  }

  static func decryptFile(from source: URL, to destination: URL, key: SymmetricKey) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = input.readData(ofLength: magic.count)
    guard header == magic else {
      // Legacy single sealed box.
      try? input.close()
      let sealedData = try Data(contentsOf: source)
      let box = try AES.GCM.SealedBox(combined: sealedData)
      let plain = try AES.GCM.open(box, using: key)
      try plain.write(to: destination, options: .atomic)
      return
    }
    _ = input.readData(ofLength: 4) // chunk size, informational

    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }

    var index: UInt32 = 0
    while true {
      let lengthData = input.readData(ofLength: 4)
      if lengthData.isEmpty { break }
      guard lengthData.count == 4 else { throw CryptoError.corrupt("length") }
      let length = Int(readBe32(lengthData))
      let combined = input.readData(ofLength: length)
      guard combined.count == length else { throw CryptoError.corrupt("chunk \(index)") }
      let box = try AES.GCM.SealedBox(combined: combined)
      let plain = try AES.GCM.open(box, using: key, authenticating: be32(index))
      output.write(plain)
      index += 1
    }
  }

  static func encryptData(_ data: Data, to destination: URL, key: SymmetricKey) throws {
    let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try data.write(to: temp, options: .atomic)
    defer { try? FileManager.default.removeItem(at: temp) }
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

  private static func readBe32(_ data: Data) -> UInt32 {
    data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
  }
}
