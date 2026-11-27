import CommonCrypto
import CryptoKit
import Foundation

/// Wire format (shared with Android): "SVB1" | be32 headerLen | header JSON | entries(be32 metaLen | meta JSON | be64 payloadLen | SVC1 payload).
/// Entry kinds: "c" check, "s" string, "f" file, "x" caller extra.
enum BackupContainer {
  static let magic = Data("SVB1".utf8)
  static let version = 1
  static let iterations = 600_000
  static let checkKey = "_check"
  static let checkValue = Data("SecureVault backup check".utf8)
  static let kdfName = "pbkdf2-hmac-sha256"
  static let cipher = "aes-256-gcm"

  /// Reject unknown iteration counts before PBKDF2 to prevent DoS via crafted headers.
  static let supportedIterations: Set<Int> = [iterations]

  static let kinds: Set<String> = ["c", "s", "f", "x"]
  static let minEntries = 3
  static let streamHeaderBytes: UInt64 = 8
  static let jsonCopies = 2

  struct Header: Codable {
    var version: Int
    var app: String
    var created: String
    var kdf: KDF
    var cipher: String
    var entries: Int
    struct KDF: Codable {
      var name: String
      var iterations: Int
      var salt: String
    }
  }

  struct Meta: Codable {
    var key: String
    var kind: String
  }

  struct Entry {
    var key: String
    var kind: String
    var source: Source

    enum Source {
      case file(URL)
      case staged((URL) throws -> Void)
    }
  }

  struct EntryInfo {
    var meta: Meta
    var payloadLength: UInt64
  }

  typealias Progress = (Int, Int) -> Void

  enum ReadPhase: String {
    case verify
    case restore = "import"
  }

  /// Decode version first so newer formats report `unsupported` even if the schema changed.
  private struct VersionField: Decodable {
    var version: Int
  }

  static func deriveKey(passphrase: String, salt: Data, iterations: Int) throws -> SymmetricKey {
    guard let rounds = UInt32(exactly: iterations), rounds > 0 else { throw BackupError.corrupt("header") }
    var derived = [UInt8](repeating: 0, count: 32)
    let passwordBytes = Array(passphrase.utf8)
    let status = salt.withUnsafeBytes { saltPointer -> Int32 in
      CCKeyDerivationPBKDF(
        CCPBKDFAlgorithm(kCCPBKDF2),
        passwordBytes.map { CChar(bitPattern: $0) }, passwordBytes.count,
        saltPointer.bindMemory(to: UInt8.self).baseAddress, salt.count,
        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), rounds,
        &derived, derived.count
      )
    }
    guard status == kCCSuccess else { throw BackupError.corrupt("key derivation") }
    return SymmetricKey(data: Data(derived))
  }

  static func readHeader(from source: URL, memory: MemoryProbe = availableMemory) throws -> Header {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    return try readHeader(input, memory: memory)
  }

  static func readHeader(_ input: FileHandle, memory: MemoryProbe) throws -> Header {
    guard try VaultCrypto.read(input, count: magic.count) == magic else {
      throw BackupError.corrupt("not a SecureVault backup")
    }
    let lengthData = try VaultCrypto.read(input, count: 4)
    guard lengthData.count == 4 else { throw BackupError.corrupt("header") }
    let length = Int(readBe32(lengthData))
    guard length <= (try remaining(input)) else { throw BackupError.corrupt("truncated") }
    try ensureMemory(for: length, memory: memory, what: "a header of \(length) bytes")
    let data = try VaultCrypto.read(input, count: length)
    guard let field = try? JSONDecoder().decode(VersionField.self, from: data) else {
      throw BackupError.corrupt("header")
    }
    guard field.version <= version else { throw BackupError.unsupported("format \(field.version)") }
    guard field.version >= version else { throw BackupError.corrupt("header") }
    guard let header = try? JSONDecoder().decode(Header.self, from: data) else {
      throw BackupError.corrupt("header")
    }
    guard header.kdf.iterations >= 1, header.kdf.iterations <= Int(Int32.max),
      header.entries >= minEntries, header.entries <= Int(Int32.max)
    else {
      throw BackupError.corrupt("header")
    }
    _ = try salt(of: header)
    guard header.kdf.name == kdfName else { throw BackupError.unsupported("key derivation \(header.kdf.name)") }
    guard header.cipher == cipher else { throw BackupError.unsupported("cipher \(header.cipher)") }
    guard supportedIterations.contains(header.kdf.iterations) else {
      throw BackupError.unsupported("\(header.kdf.iterations) iterations")
    }
    return header
  }

  static func salt(of header: Header) throws -> Data {
    guard let salt = Data(base64Encoded: header.kdf.salt), !salt.isEmpty else { throw BackupError.corrupt("salt") }
    return salt
  }

  static func readMetas(from source: URL, memory: MemoryProbe = availableMemory) throws -> [Meta] {
    try readLayout(from: source, memory: memory).map(\.meta)
  }

  static func readLayout(from source: URL, memory: MemoryProbe = availableMemory) throws -> [EntryInfo] {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input, memory: memory)
    var layout: [EntryInfo] = []
    var keys = Set<String>()
    for index in 0..<header.entries {
      let (meta, size) = try readEntryHead(input, index: index, memory: memory)
      guard kinds.contains(meta.kind) else { throw BackupError.corrupt("entry \(index) kind") }
      if index == 0 {
        guard meta.kind == "c", meta.key == checkKey else { throw BackupError.corrupt("check entry") }
      } else {
        guard meta.kind != "c" else { throw BackupError.corrupt("entry \(index) kind") }
        guard keys.insert(meta.key).inserted else { throw BackupError.corrupt("duplicate entry") }
      }
      try input.seek(toOffset: try input.offset() + size)
      layout.append(EntryInfo(meta: meta, payloadLength: size))
    }
    guard try remaining(input) == 0 else { throw BackupError.corrupt("trailing data") }
    return layout
  }

  static func readEntryHead(_ input: FileHandle, index: Int, memory: MemoryProbe) throws -> (Meta, UInt64) {
    let metaLength = try VaultCrypto.read(input, count: 4)
    guard metaLength.count == 4 else { throw BackupError.corrupt("entry \(index)") }
    let metaSize = Int(readBe32(metaLength))
    guard metaSize <= (try remaining(input)) else { throw BackupError.corrupt("truncated") }
    try ensureMemory(for: metaSize, memory: memory, what: "an entry name of \(metaSize) bytes")
    guard let meta = try? JSONDecoder().decode(Meta.self, from: VaultCrypto.read(input, count: metaSize)) else {
      throw BackupError.corrupt("entry \(index)")
    }
    let sizeData = try VaultCrypto.read(input, count: 8)
    guard sizeData.count == 8 else { throw BackupError.corrupt("entry \(index)") }
    let size = readBe64(sizeData)
    guard size <= UInt64(try remaining(input)) else { throw BackupError.corrupt("truncated") }
    return (meta, size)
  }

  static func remaining(_ input: FileHandle) throws -> Int {
    let offset = try input.offset()
    let end = try input.seekToEnd()
    try input.seek(toOffset: offset)
    return offset < end ? Int(end - offset) : 0
  }
}
