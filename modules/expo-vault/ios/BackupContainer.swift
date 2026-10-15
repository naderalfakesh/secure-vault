import CommonCrypto
import CryptoKit
import Foundation

enum BackupError: LocalizedError {
  case corrupt(String)
  case passphrase
  case unsupported(Int)

  var errorDescription: String? {
    switch self {
    case .corrupt(let reason): return "The backup file is not valid: \(reason)"
    case .passphrase: return "That passphrase does not match this backup."
    case .unsupported(let version): return "This backup needs a newer version of the app (format \(version))."
    }
  }
}

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
    /// Plaintext on disk (for export) or encrypted source (for import).
    var url: URL
  }

  typealias Progress = (Int, Int) -> Void

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

  /// Writes the container. `entries` hold plaintext files; the caller removes them.
  static func write(
    to destination: URL, passphrase: String, entries: [Entry], progress: Progress
  ) throws -> (entries: Int, bytes: Int) {
    var salt = Data(count: 16)
    let result = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }
    guard result == errSecSuccess else { throw BackupError.corrupt("random") }
    let key = try deriveKey(passphrase: passphrase, salt: salt, iterations: iterations)

    let formatter = ISO8601DateFormatter()
    let header = Header(
      version: version, app: "SecureVault", created: formatter.string(from: Date()),
      kdf: .init(name: "pbkdf2-hmac-sha256", iterations: iterations, salt: salt.base64EncodedString()),
      cipher: "aes-256-gcm", entries: entries.count + 1
    )

    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }
    output.write(magic)
    let headerData = try JSONEncoder().encode(header)
    output.write(be32(UInt32(headerData.count)))
    output.write(headerData)

    let checkFile = temporaryFile()
    try checkValue.write(to: checkFile)
    defer { try? FileManager.default.removeItem(at: checkFile) }
    let all = [Entry(key: checkKey, kind: "c", url: checkFile)] + entries
    for (index, entry) in all.enumerated() {
      let payload = temporaryFile()
      defer { try? FileManager.default.removeItem(at: payload) }
      try VaultCrypto.encryptFile(from: entry.url, to: payload, key: key)
      let meta = try JSONEncoder().encode(Meta(key: entry.key, kind: entry.kind))
      output.write(be32(UInt32(meta.count)))
      output.write(meta)
      let size = try FileManager.default.attributesOfItem(atPath: payload.path)[.size] as? UInt64 ?? 0
      output.write(be64(size))
      try append(contentsOf: payload, to: output)
      progress(index + 1, all.count)
    }
    let bytes = try FileManager.default.attributesOfItem(atPath: destination.path)[.size] as? Int ?? 0
    return (entries.count, bytes)
  }

  static func readHeader(from source: URL) throws -> Header {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    return try readHeader(input)
  }

  /// Expects `input` at the start of the file. The header length is checked
  /// against the bytes left in the file, and the entry count and iterations
  /// must fit the types they are used as, before anything is allocated or
  /// derived.
  private static func readHeader(_ input: FileHandle) throws -> Header {
    guard try VaultCrypto.read(input, count: magic.count) == magic else {
      throw BackupError.corrupt("not a SecureVault backup")
    }
    let lengthData = try VaultCrypto.read(input, count: 4)
    guard lengthData.count == 4 else { throw BackupError.corrupt("header") }
    let length = Int(readBe32(lengthData))
    guard length <= (try remaining(input)) else { throw BackupError.corrupt("truncated") }
    guard let header = try? JSONDecoder().decode(Header.self, from: VaultCrypto.read(input, count: length)) else {
      throw BackupError.corrupt("header")
    }
    guard header.version <= version else { throw BackupError.unsupported(header.version) }
    guard header.entries >= 0, let rounds = UInt32(exactly: header.kdf.iterations), rounds > 0 else {
      throw BackupError.corrupt("header")
    }
    _ = try salt(of: header)
    return header
  }

  /// The salt must decode to at least one byte, as on Android, so an empty or
  /// undecodable salt is a damaged header rather than a wrong passphrase.
  private static func salt(of header: Header) throws -> Data {
    guard let salt = Data(base64Encoded: header.kdf.salt), !salt.isEmpty else { throw BackupError.corrupt("salt") }
    return salt
  }

  /// Entry metadata only, read by seeking past each payload. No key is derived
  /// and nothing is decrypted, so a bad key or a truncated file is found before
  /// the vault is touched.
  static func readMetas(from source: URL) throws -> [Meta] {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input)
    var metas: [Meta] = []
    for index in 0..<header.entries {
      let (meta, size) = try readEntryHead(input, index: index)
      try input.seek(toOffset: try input.offset() + size)
      metas.append(meta)
    }
    return metas
  }

  /// Reads one entry's metadata and payload length, leaving `input` at the
  /// payload. Both lengths are checked against the bytes left in the file.
  private static func readEntryHead(_ input: FileHandle, index: Int) throws -> (Meta, UInt64) {
    let metaLength = try VaultCrypto.read(input, count: 4)
    guard metaLength.count == 4 else { throw BackupError.corrupt("entry \(index)") }
    let metaSize = Int(readBe32(metaLength))
    guard metaSize <= (try remaining(input)) else { throw BackupError.corrupt("truncated") }
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
  private static func remaining(_ input: FileHandle) throws -> Int {
    let offset = try input.offset()
    let end = try input.seekToEnd()
    try input.seek(toOffset: offset)
    return offset < end ? Int(end - offset) : 0
  }

  /// Which pass of a restore a progress event belongs to; the raw value is
  /// the phase name sent to JavaScript.
  enum ReadPhase: String {
    case verify
    case restore = "import"
  }

  /// Decrypts every entry in two passes. The first checks the passphrase
  /// against the check entry, then decrypts every other payload to nothing,
  /// so a backup that is damaged anywhere, including its last entry, is
  /// refused before `handle` runs. The second decrypts again and hands each
  /// plaintext file to `handle`, which owns it. The second pass is not a
  /// transaction: once `handle` has started replacing the vault, a disk, I/O
  /// or key failure still leaves it partly restored; the caller reports that
  /// case separately.
  ///
  /// `validate` sees each entry's metadata on every pass; `validateAll` sees
  /// the whole list once, after the pre-pass and before the key is derived,
  /// for rules about which entries must be present.
  static func read(
    from source: URL, passphrase: String, validate: (Meta) throws -> Void,
    validateAll: ([Meta]) throws -> Void = { _ in },
    progress: (ReadPhase, Int, Int) -> Void, handle: (Meta, URL) throws -> Void
  ) throws {
    let metas = try readMetas(from: source)
    for meta in metas { try validate(meta) }
    try validateAll(metas)
    let header = try readHeader(from: source)
    let key = try deriveKey(passphrase: passphrase, salt: try salt(of: header), iterations: header.kdf.iterations)

    try walk(source, validate: validate, progress: { progress(.verify, $0, $1) }) { meta, payload in
      if meta.kind == "c" {
        try verifyCheck(payload, key: key)
      } else {
        do { try VaultCrypto.verifyFile(at: payload, key: key) } catch { throw BackupError.corrupt("entry \(meta.key)") }
      }
    }
    try walk(source, validate: validate, progress: { progress(.restore, $0, $1) }) { meta, payload in
      if meta.kind == "c" {
        try verifyCheck(payload, key: key)
        return
      }
      let plain = temporaryFile()
      do {
        try VaultCrypto.decryptFile(from: payload, to: plain, key: key)
      } catch {
        try? FileManager.default.removeItem(at: plain)
        throw BackupError.corrupt("entry \(meta.key)")
      }
      try handle(meta, plain)
    }
  }

  /// The check entry must decrypt to the fixed value; anything else means the
  /// passphrase is wrong.
  private static func verifyCheck(_ payload: URL, key: SymmetricKey) throws {
    let plain = temporaryFile()
    defer { try? FileManager.default.removeItem(at: plain) }
    do { try VaultCrypto.decryptFile(from: payload, to: plain, key: key) } catch { throw BackupError.passphrase }
    guard (try? Data(contentsOf: plain)) == checkValue else { throw BackupError.passphrase }
  }

  /// One pass over the container: each entry's metadata is validated again,
  /// its payload is copied to a temporary file that `visit` may read but not
  /// keep, and progress is reported per entry.
  private static func walk(
    _ source: URL, validate: (Meta) throws -> Void, progress: Progress,
    visit: (Meta, URL) throws -> Void
  ) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input)
    for index in 0..<header.entries {
      // Lengths and metadata are checked again in case the file changed since the pre-pass.
      let (meta, size) = try readEntryHead(input, index: index)
      try validate(meta)
      let payload = temporaryFile()
      defer { try? FileManager.default.removeItem(at: payload) }
      try copy(from: input, bytes: size, to: payload)
      try visit(meta, payload)
      progress(index + 1, header.entries)
    }
  }

  static func temporaryFile() -> URL {
    FileManager.default.temporaryDirectory.appendingPathComponent("backup-\(UUID().uuidString)")
  }

  private static func append(contentsOf source: URL, to output: FileHandle) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    while true {
      let chunk = input.readData(ofLength: 1_048_576)
      if chunk.isEmpty { break }
      output.write(chunk)
    }
  }

  private static func copy(from input: FileHandle, bytes: UInt64, to destination: URL) throws {
    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }
    var remaining = bytes
    while remaining > 0 {
      let chunk = try VaultCrypto.read(input, count: Int(min(remaining, 1_048_576)))
      guard !chunk.isEmpty else { throw BackupError.corrupt("truncated") }
      try output.write(contentsOf: chunk)
      remaining -= UInt64(chunk.count)
    }
  }

  private static func be32(_ value: UInt32) -> Data {
    withUnsafeBytes(of: value.bigEndian) { Data($0) }
  }

  private static func be64(_ value: UInt64) -> Data {
    withUnsafeBytes(of: value.bigEndian) { Data($0) }
  }

  private static func readBe32(_ data: Data) -> UInt32 {
    data.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).bigEndian }
  }

  private static func readBe64(_ data: Data) -> UInt64 {
    data.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self).bigEndian }
  }
}
