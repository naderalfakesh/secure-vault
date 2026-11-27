import CommonCrypto
import CryptoKit
import Foundation

/// Passphrase-protected backup container, identical on iOS and Android:
///
///   "SVB1" | be32 headerLength | header JSON
///   then, per entry: be32 metaLength | meta JSON | be64 payloadLength | payload
///
/// The payload is the vault's own chunked AES-256-GCM stream, keyed with a key
/// derived from the passphrase (PBKDF2-HMAC-SHA256). The first entry is a
/// fixed check value so a wrong passphrase is rejected before anything is
/// touched. Entry kinds: "s" string, "f" vault file, "x" extra file returned
/// to the caller (the SQLite index), "c" the check.
enum BackupContainer {
  static let magic = Data("SVB1".utf8)
  static let version = 1
  static let iterations = 600_000
  static let checkKey = "_check"
  static let checkValue = Data("SecureVault backup check".utf8)
  static let kdfName = "pbkdf2-hmac-sha256"
  static let cipher = "aes-256-gcm"

  /// Every iteration count a committed exporter has written (all of them
  /// write `iterations`). A reader refuses anything else before the key
  /// derivation runs, so a crafted header cannot make PBKDF2 run for hours.
  /// An exporter that changes the count must bump `version`.
  static let supportedIterations: Set<Int> = [iterations]

  /// The kinds a version-1 exporter writes; anything else is refused in the pre-pass.
  static let kinds: Set<String> = ["c", "s", "f", "x"]

  /// The check entry, the database key string and the index extra: the
  /// smallest backup the app writes.
  static let minEntries = 3

  /// The `SVC1` magic and chunk-size field that open every payload; a
  /// plaintext is at most the rest.
  static let streamHeaderBytes: UInt64 = 8

  /// Transient copies `JSONDecoder` makes of a header or meta: the bytes read
  /// and the parsed form.
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

    /// Where an entry's plaintext comes from while the container is written.
    enum Source {
      /// A file that is safe to leave where it is: the caller's extra files,
      /// which their owner already encrypts (the SQLCipher index).
      case file(URL)
      /// Plaintext produced on demand into a file inside the staging
      /// directory. `write` removes it as soon as the entry is encrypted, so
      /// at most one entry is in plaintext at any time.
      case staged((URL) throws -> Void)
    }
  }

  /// One entry as the pre-pass found it: its metadata and the payload length it declares.
  struct EntryInfo {
    var meta: Meta
    var payloadLength: UInt64
  }

  typealias Progress = (Int, Int) -> Void

  /// Which pass of a restore a progress event belongs to; the raw value is
  /// the phase name sent to JavaScript.
  enum ReadPhase: String {
    case verify
    case restore = "import"
  }

  /// Only the version, read first so a newer format is named as such even
  /// when the rest of its header has another shape.
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

  /// Expects `input` at the start of the file. The header length is checked
  /// against the bytes left in the file and against the memory the OS says
  /// the process can still use, before it is read. Then, in the same order as
  /// on Android: the version must be an integer (above 1 is a newer format,
  /// below 1 a damaged header); every field the exporter writes must be
  /// present with its JSON type and the counts must fit their types
  /// (otherwise `corrupt`); and the KDF name, cipher and iteration count must
  /// be the ones a committed exporter wrote (otherwise `unsupported`). All of
  /// it runs before any key is derived.
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

  /// The salt must decode to at least one byte, as on Android, so an empty or
  /// undecodable salt is a damaged header rather than a wrong passphrase.
  static func salt(of header: Header) throws -> Data {
    guard let salt = Data(base64Encoded: header.kdf.salt), !salt.isEmpty else { throw BackupError.corrupt("salt") }
    return salt
  }

  /// Entry metadata only, read by seeking past each payload. No key is derived
  /// and nothing is decrypted, so a bad key or a truncated file is found before
  /// the vault is touched.
  static func readMetas(from source: URL, memory: MemoryProbe = availableMemory) throws -> [Meta] {
    try readLayout(from: source, memory: memory).map(\.meta)
  }

  /// The pre-pass: every entry's metadata and declared payload length, with
  /// the structure every version-1 exporter writes enforced before any key is
  /// derived. The first entry is the check entry and no other entry has its
  /// kind; every kind is one the exporter writes; no two other entries share a
  /// key (they come from one directory listing plus the index extra); and the
  /// file ends right after the last declared entry. Anything else is `corrupt`.
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

  /// Reads one entry's metadata and payload length, leaving `input` at the
  /// payload. Both lengths are checked against the bytes left in the file, and
  /// the meta length against the memory the OS says is left.
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

  /// Bytes between the current offset and the end of the file, as it is now.
  static func remaining(_ input: FileHandle) throws -> Int {
    let offset = try input.offset()
    let end = try input.seekToEnd()
    try input.seek(toOffset: offset)
    return offset < end ? Int(end - offset) : 0
  }
}
