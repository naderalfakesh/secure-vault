import CryptoKit
import Foundation

extension BackupContainer {
  static func write(
    to destination: URL, passphrase: String, staging: StagingDirectory, entries: [Entry], progress: Progress
  ) throws -> (entries: Int, bytes: Int) {
    try sweep(staging)
    let written: (entries: Int, bytes: Int)
    do {
      written = try writeEntries(
        to: destination, passphrase: passphrase, staging: staging, entries: entries, progress: progress
      )
    } catch {
      try? sweep(staging)
      throw error
    }
    try sweep(staging)
    return written
  }

  private static func writeEntries(
    to destination: URL, passphrase: String, staging: StagingDirectory, entries: [Entry], progress: Progress
  ) throws -> (entries: Int, bytes: Int) {
    var salt = Data(count: 16)
    let result = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }
    guard result == errSecSuccess else { throw BackupError.corrupt("random") }
    let key = try deriveKey(passphrase: passphrase, salt: salt, iterations: iterations)

    let formatter = ISO8601DateFormatter()
    let header = Header(
      version: version, app: "SecureVault", created: formatter.string(from: Date()),
      kdf: .init(name: kdfName, iterations: iterations, salt: salt.base64EncodedString()),
      cipher: cipher, entries: entries.count + 1
    )

    FileManager.default.createFile(atPath: destination.path, contents: nil)
    let output = try FileHandle(forWritingTo: destination)
    defer { try? output.close() }
    output.write(magic)
    let headerData = try JSONEncoder().encode(header)
    output.write(be32(UInt32(headerData.count)))
    output.write(headerData)

    let check = Entry(key: checkKey, kind: "c", source: .staged { try checkValue.write(to: $0) })
    let all = [check] + entries
    for (index, entry) in all.enumerated() {
      let plain = staging.url.appendingPathComponent("plain-\(UUID().uuidString)")
      let payload = staging.url.appendingPathComponent("payload-\(UUID().uuidString)")
      defer {
        try? FileManager.default.removeItem(at: plain)
        try? FileManager.default.removeItem(at: payload)
      }
      let source: URL
      switch entry.source {
      case .file(let url):
        source = url
      case .staged(let produce):
        try produce(plain)
        source = plain
      }
      try VaultCrypto.encryptFile(from: source, to: payload, key: key)
      // Drop plaintext before copying payload out.
      try? FileManager.default.removeItem(at: plain)
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

  static func read(
    from source: URL, passphrase: String, staging: StagingDirectory, validate: (Meta) throws -> Void,
    validateAll: ([Meta]) throws -> Void = { _ in },
    progress: (ReadPhase, Int, Int) -> Void,
    preflight: ([EntryInfo]) throws -> Void = { _ in },
    memory: MemoryProbe = availableMemory,
    isCancelled: () -> Bool = { false },
    commit: (() -> Bool)? = nil,
    handle: (Meta, URL) throws -> Void
  ) throws {
    try sweep(staging)
    defer { try? sweep(staging) }
    let layout = try readLayout(from: source, memory: memory)
    let metas = layout.map(\.meta)
    for meta in metas { try validate(meta) }
    try validateAll(metas)
    let header = try readHeader(from: source, memory: memory)
    let key = try deriveKey(passphrase: passphrase, salt: try salt(of: header), iterations: header.kdf.iterations)

    func stopIfCancelled() throws {
      if isCancelled() { throw BackupError.cancelled }
    }
    try walk(
      source, staging: staging, validate: validate, memory: memory, progress: { progress(.verify, $0, $1) },
      beforeEntry: stopIfCancelled
    ) { meta, payload in
      if meta.kind == "c" {
        try verifyCheck(payload, key: key, staging: staging)
      } else {
        do { try VaultCrypto.verifyFile(at: payload, key: key) } catch { throw BackupError.corrupt("entry \(meta.key)") }
      }
    }
    try stopIfCancelled()
    try preflight(layout)
    // Last point a cancel is honoured before handle mutates the vault.
    if !(commit?() ?? !isCancelled()) { throw BackupError.cancelled }
    try walk(source, staging: staging, validate: validate, memory: memory, progress: { progress(.restore, $0, $1) }) { meta, payload in
      if meta.kind == "c" {
        try verifyCheck(payload, key: key, staging: staging)
        return
      }
      let plain = temporaryFile(in: staging)
      do {
        try VaultCrypto.decryptFile(from: payload, to: plain, key: key)
      } catch {
        try? FileManager.default.removeItem(at: plain)
        throw BackupError.corrupt("entry \(meta.key)")
      }
      defer { try? FileManager.default.removeItem(at: plain) }
      try handle(meta, plain)
    }
  }

  private static func verifyCheck(_ payload: URL, key: SymmetricKey, staging: StagingDirectory) throws {
    let plain = temporaryFile(in: staging)
    defer { try? FileManager.default.removeItem(at: plain) }
    do { try VaultCrypto.decryptFile(from: payload, to: plain, key: key) } catch { throw BackupError.passphrase }
    guard (try? Data(contentsOf: plain)) == checkValue else { throw BackupError.passphrase }
  }

  private static func walk(
    _ source: URL, staging: StagingDirectory, validate: (Meta) throws -> Void, memory: MemoryProbe,
    progress: Progress, beforeEntry: () throws -> Void = {}, visit: (Meta, URL) throws -> Void
  ) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input, memory: memory)
    for index in 0..<header.entries {
      try beforeEntry()
      // Re-validate lengths/metadata in case the source file changed since pre-pass.
      let (meta, size) = try readEntryHead(input, index: index, memory: memory)
      try validate(meta)
      let payload = temporaryFile(in: staging)
      defer { try? FileManager.default.removeItem(at: payload) }
      try copy(from: input, bytes: size, to: payload)
      try visit(meta, payload)
      progress(index + 1, header.entries)
    }
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

  static func be32(_ value: UInt32) -> Data {
    withUnsafeBytes(of: value.bigEndian) { Data($0) }
  }

  static func be64(_ value: UInt64) -> Data {
    withUnsafeBytes(of: value.bigEndian) { Data($0) }
  }

  static func readBe32(_ data: Data) -> UInt32 {
    data.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).bigEndian }
  }

  static func readBe64(_ data: Data) -> UInt64 {
    data.withUnsafeBytes { $0.loadUnaligned(as: UInt64.self).bigEndian }
  }
}
