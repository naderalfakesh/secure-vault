import CryptoKit
import Foundation
import XCTest

@testable import VaultFormats

/// The shared vectors in ../fixtures, written by make-fixtures.mjs. The Kotlin
/// suite reads the same files.
struct Vectors: Decodable {
  struct Stream: Decodable {
    let name: String
    let file: String
    let plaintext: String
  }

  struct Broken: Decodable {
    let name: String
    let file: String
  }

  struct Single: Decodable {
    let name: String
    let file: String
    let plaintext: String
    let nonce: String?
  }

  struct Backup: Decodable {
    struct Entry: Decodable {
      let key: String
      let kind: String
      let plaintext: String
    }

    let name: String
    let file: String
    let passphrase: String
    let expect: String
    let entries: [Entry]?
  }

  let key: String
  let streams: [Stream]
  let brokenStreams: [Broken]
  let legacyApple: Single
  let backups: [Backup]
}

enum Fixtures {
  static let directory = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .appendingPathComponent("fixtures", isDirectory: true)

  static let vectors: Vectors = {
    do {
      return try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url("vectors.json")))
    } catch {
      fatalError("Cannot read the vectors; run make-fixtures.mjs: \(error)")
    }
  }()

  static var key: SymmetricKey { SymmetricKey(data: Data(hex: vectors.key)) }

  static func url(_ name: String) -> URL { directory.appendingPathComponent(name) }

  static func data(_ name: String) throws -> Data { try Data(contentsOf: url(name)) }
}

/// A scratch folder per test, with the `caches/backup-staging` layout the
/// container insists on.
final class Scratch {
  let root: URL
  let caches: URL

  init() throws {
    root = FileManager.default.temporaryDirectory
      .appendingPathComponent("vault-formats-\(UUID().uuidString)", isDirectory: true)
      .resolvingSymlinksInPath()
    caches = root.appendingPathComponent("caches", isDirectory: true)
    try FileManager.default.createDirectory(at: caches, withIntermediateDirectories: true)
  }

  func file(_ name: String) -> URL { root.appendingPathComponent(name) }

  func staging() throws -> BackupContainer.StagingDirectory {
    let path = caches.appendingPathComponent(BackupContainer.StagingDirectory.name).path
    try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    return try BackupContainer.StagingDirectory(requested: path, caches: caches)
  }

  func remove() { try? FileManager.default.removeItem(at: root) }
}

extension Data {
  init(hex: String) {
    var bytes = [UInt8]()
    var index = hex.startIndex
    while index < hex.endIndex {
      let next = hex.index(index, offsetBy: 2)
      bytes.append(UInt8(hex[index..<next], radix: 16)!)
      index = next
    }
    self.init(bytes)
  }

  static func random(count: Int) -> Data {
    var generator = SystemRandomNumberGenerator()
    return Data((0..<count).map { _ in UInt8.random(in: .min ... .max, using: &generator) })
  }
}
