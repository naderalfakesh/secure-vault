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
    var derived = [UInt8](repeating: 0, count: 32)
    let passwordBytes = Array(passphrase.utf8)
    let status = salt.withUnsafeBytes { saltPointer -> Int32 in
      CCKeyDerivationPBKDF(
        CCPBKDFAlgorithm(kCCPBKDF2),
        passwordBytes.map { CChar(bitPattern: $0) }, passwordBytes.count,
        saltPointer.bindMemory(to: UInt8.self).baseAddress, salt.count,
        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations),
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

  private static func readHeader(_ input: FileHandle) throws -> Header {
    guard input.readData(ofLength: magic.count) == magic else { throw BackupError.corrupt("not a SecureVault backup") }
    let lengthData = input.readData(ofLength: 4)
    guard lengthData.count == 4 else { throw BackupError.corrupt("header") }
    let headerData = input.readData(ofLength: Int(readBe32(lengthData)))
    guard let header = try? JSONDecoder().decode(Header.self, from: headerData) else {
      throw BackupError.corrupt("header")
    }
    guard header.version <= version else { throw BackupError.unsupported(header.version) }
    return header
  }

  /// Streams every entry as a decrypted plaintext file. The check entry is
  /// verified first; `handle` receives the others and owns the plaintext file.
  static func read(
    from source: URL, passphrase: String, progress: Progress,
    handle: (Meta, URL) throws -> Void
  ) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input)
    guard let salt = Data(base64Encoded: header.kdf.salt) else { throw BackupError.corrupt("salt") }
    let key = try deriveKey(passphrase: passphrase, salt: salt, iterations: header.kdf.iterations)

    for index in 0..<header.entries {
      let metaLength = input.readData(ofLength: 4)
      guard metaLength.count == 4 else { throw BackupError.corrupt("entry \(index)") }
      let metaData = input.readData(ofLength: Int(readBe32(metaLength)))
      guard let meta = try? JSONDecoder().decode(Meta.self, from: metaData) else { throw BackupError.corrupt("entry \(index)") }
      let sizeData = input.readData(ofLength: 8)
      guard sizeData.count == 8 else { throw BackupError.corrupt("entry \(index)") }
      let size = readBe64(sizeData)

      let payload = temporaryFile()
      defer { try? FileManager.default.removeItem(at: payload) }
      try copy(from: input, bytes: size, to: payload)
      let plain = temporaryFile()
      do {
        try VaultCrypto.decryptFile(from: payload, to: plain, key: key)
      } catch {
        try? FileManager.default.removeItem(at: plain)
        if meta.kind == "c" { throw BackupError.passphrase }
        throw BackupError.corrupt("entry \(meta.key)")
      }
      if meta.kind == "c" {
        defer { try? FileManager.default.removeItem(at: plain) }
        guard (try? Data(contentsOf: plain)) == checkValue else { throw BackupError.passphrase }
      } else {
        try handle(meta, plain)
      }
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
      let chunk = input.readData(ofLength: Int(min(remaining, 1_048_576)))
      guard !chunk.isEmpty else { throw BackupError.corrupt("truncated") }
      output.write(chunk)
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
