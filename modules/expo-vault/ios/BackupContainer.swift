import CommonCrypto
import CryptoKit
import Foundation
import os

enum BackupError: LocalizedError {
  case corrupt(String)
  case passphrase
  /// A header setting no committed exporter writes: a newer format, or KDF or
  /// cipher settings outside the verified set.
  case unsupported(String)
  /// The device cannot hold what the restore needs in memory; raised before
  /// anything is removed.
  case resource(String)
  /// The restore needs more disk than is free plus what the old vault frees;
  /// raised before anything is removed.
  case noSpace(needed: Int64, available: Int64)
  /// The caller asked to stop while the restore was still checking; nothing
  /// was handled.
  case cancelled

  var errorDescription: String? {
    switch self {
    case .corrupt(let reason): return "The backup file is not valid: \(reason)"
    case .passphrase: return "That passphrase does not match this backup."
    case .unsupported(let reason):
      return "This backup uses settings this version of the app does not support: \(reason)."
    case .resource(let reason): return "This device does not have enough memory to restore this backup: \(reason)."
    case .noSpace(let needed, let available):
      return "This device does not have enough free space to restore this backup (needs \(needed) bytes, has \(available))."
    case .cancelled: return "The restore was cancelled before anything was changed."
    }
  }
}

/// The cancel request of a restore, tied to the restore's run id. A request
/// names its run: it acts on the running restore with that id, or is kept for
/// the next one to start while none runs, and only a restore with that id
/// honours it. A request for any other id (one that already ended, or while a
/// different one runs) is ignored and answers false, and a kept request for
/// another id is discarded when a restore starts. The last cancel point and a
/// request exclude each other under one lock, so a request answered true is
/// always honoured.
final class RestoreCancelFlag {
  private enum State { case open, cancel, committed }
  private let lock = NSLock()
  private var state = State.open
  private var current: String?
  private var lastEnded: String?
  private var pending: String?

  /// A restore with `runId` starts; a request kept for it is honoured, any other is dropped.
  func start(_ runId: String) {
    lock.lock()
    defer { lock.unlock() }
    current = runId
    state = pending == runId ? .cancel : .open
    pending = nil
  }

  /// The restore with `runId` ended, either way.
  func finish(_ runId: String) {
    lock.lock()
    defer { lock.unlock() }
    guard current == runId else { return }
    current = nil
    lastEnded = runId
    state = .open
  }

  var isRequested: Bool {
    lock.lock()
    defer { lock.unlock() }
    return state == .cancel
  }

  /// True when the restore with `runId` will honour the request.
  func request(_ runId: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if let running = current {
      if running != runId || state == .committed { return false }
      state = .cancel
      return true
    }
    if runId == lastEnded { return false }
    pending = runId
    return true
  }

  /// Marks the last cancel point passed; false when a cancel was asked first.
  func commit() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if state == .cancel { return false }
    state = .committed
    return true
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

  /// What the process may still allocate before the OS ends it, or nil when
  /// the OS gives no figure (`os_proc_available_memory` returns 0 outside an
  /// app process with a memory limit). A trial allocation is not used on iOS:
  /// a successful `malloc` does not mean the pages can be touched before the
  /// process is killed.
  static func availableMemory() -> Int? {
    let available = os_proc_available_memory()
    return available > 0 ? available : nil
  }

  typealias MemoryProbe = () -> Int?

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

  typealias Progress = (Int, Int) -> Void

  struct StagingDirectoryError: LocalizedError {
    let reason: String
    var errorDescription: String? { "The backup staging folder is not allowed: \(reason)" }
  }

  /// The one folder export plaintext may be staged in, `<caches>/backup-staging`,
  /// or restore plaintext, `<caches>/restore-staging`. The requested path is
  /// standardized and symlink-resolved, then compared exactly with the app's
  /// own cache location, so a sweep can never reach the cache root, the vault,
  /// or whatever a planted link points at. Only this type can be handed to
  /// `write`, `read` and `sweep`.
  struct StagingDirectory {
    static let name = "backup-staging"
    static let restoreName = "restore-staging"
    let url: URL

    init(requested: String, caches: URL, name: String = StagingDirectory.name) throws {
      guard requested.hasPrefix("/") else { throw StagingDirectoryError(reason: "not an absolute path") }
      let candidate = URL(fileURLWithPath: requested, isDirectory: true).standardizedFileURL
      // attributesOfItem does not follow links, so a symlink at the path is
      // refused here even when it points at the right place.
      if let type = (try? FileManager.default.attributesOfItem(atPath: candidate.path))?[.type] as? FileAttributeType {
        guard type == .typeDirectory else { throw StagingDirectoryError(reason: "not a directory") }
      }
      let expected = caches.standardizedFileURL.resolvingSymlinksInPath()
        .appendingPathComponent(name, isDirectory: true)
      guard candidate.resolvingSymlinksInPath().path == expected.path else {
        throw StagingDirectoryError(reason: "not the app's \(name) cache folder")
      }
      url = expected
    }
  }

  /// Empties the staging directory, creating it if needed. Backup and restore
  /// plaintext only ever lives there, so one sweep is the whole cleanup after a crash.
  /// `removeItem` deletes a link itself and never follows it. Throws when the
  /// folder cannot be created or something in it could not be removed:
  /// staging must not start next to leftover plaintext.
  static func sweep(_ staging: StagingDirectory) throws {
    let fileManager = FileManager.default
    // attributesOfItem does not follow links, so a link swapped in for the
    // folder after it was resolved is refused instead of emptied.
    if let type = (try? fileManager.attributesOfItem(atPath: staging.url.path))?[.type] as? FileAttributeType {
      guard type == .typeDirectory else { throw StagingDirectoryError(reason: "cannot be created") }
    } else {
      do {
        try fileManager.createDirectory(at: staging.url, withIntermediateDirectories: true)
      } catch {
        throw StagingDirectoryError(reason: "cannot be created")
      }
    }
    do {
      for item in try fileManager.contentsOfDirectory(at: staging.url, includingPropertiesForKeys: nil) {
        try fileManager.removeItem(at: item)
      }
    } catch {
      throw StagingDirectoryError(reason: "could not be emptied")
    }
  }

  struct RemovalError: LocalizedError {
    let reason: String
    var errorDescription: String? { "The cache entry cannot be removed: \(reason)" }
  }

  /// Removes `requested` for the app's cache sweeps without following
  /// symbolic links: `removeItem` unlinks a link itself and never recurses
  /// through one. Its parent is symlink-resolved and must lie inside one of
  /// `roots`, so neither `..` nor a linked ancestor can carry the removal out
  /// of them. Each of `exact` also qualifies, but only itself: the same name
  /// directly inside its resolved parent, never an entry below it, so a link
  /// planted in its place is unlinked and its target left alone. A missing
  /// entry, a dangling link's target included, is fine.
  static func removeNoFollow(_ requested: String, roots: [URL], exact: [URL] = []) throws {
    guard requested.hasPrefix("/") else { throw RemovalError(reason: "not an absolute path") }
    let url = URL(fileURLWithPath: requested).standardizedFileURL
    let name = url.lastPathComponent
    guard !name.isEmpty, name != "/", name != ".", name != ".." else {
      throw RemovalError(reason: "not a single name")
    }
    let parent = url.deletingLastPathComponent().resolvingSymlinksInPath().path
    let inside = roots.contains { root in
      let base = root.standardizedFileURL.resolvingSymlinksInPath().path
      return parent == base || parent.hasPrefix(base + "/")
    }
    let named = exact.contains { allowed in
      allowed.lastPathComponent == name
        && allowed.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath().path == parent
    }
    guard inside || named else { throw RemovalError(reason: "not inside the app's cache") }
    let target = URL(fileURLWithPath: parent).appendingPathComponent(name)
    // attributesOfItem does not follow links, so a dangling link still counts as there.
    guard (try? FileManager.default.attributesOfItem(atPath: target.path)) != nil else { return }
    do {
      try FileManager.default.removeItem(at: target)
    } catch {
      throw RemovalError(reason: "could not be removed")
    }
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

  /// Writes the container. Plaintext is staged one entry at a time inside
  /// `staging`, which is swept first (an earlier export may have been killed
  /// mid-entry) and left empty whether the write succeeds or fails.
  ///
  /// When the write fails, the cleanup sweep is best effort and the write's
  /// own error is what the caller sees. After a successful write, a cleanup
  /// error fails the export, because a success must not be reported while
  /// plaintext may still be on disk.
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
      // The plaintext has been consumed; drop it before the payload is copied out.
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

  static func readHeader(from source: URL, memory: MemoryProbe = availableMemory) throws -> Header {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    return try readHeader(input, memory: memory)
  }

  /// Only the version, read first so a newer format is named as such even
  /// when the rest of its header has another shape.
  private struct VersionField: Decodable {
    var version: Int
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
  private static func readHeader(_ input: FileHandle, memory: MemoryProbe) throws -> Header {
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

  /// Refuses a declared length whose decoding would need more memory than the
  /// OS says is left. Unknown memory (no figure from the OS) is not a refusal.
  private static func ensureMemory(for length: Int, memory: MemoryProbe, what: String) throws {
    guard let available = memory() else { return }
    let (needed, overflow) = length.multipliedReportingOverflow(by: jsonCopies)
    if overflow || needed > available { throw BackupError.resource(what) }
  }

  /// The salt must decode to at least one byte, as on Android, so an empty or
  /// undecodable salt is a damaged header rather than a wrong passphrase.
  private static func salt(of header: Header) throws -> Data {
    guard let salt = Data(base64Encoded: header.kdf.salt), !salt.isEmpty else { throw BackupError.corrupt("salt") }
    return salt
  }

  /// One entry as the pre-pass found it: its metadata and the payload length it declares.
  struct EntryInfo {
    var meta: Meta
    var payloadLength: UInt64
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

  /// What the restore pass needs, worked out from the pre-pass before anything is removed.
  struct RestoreNeeds {
    /// Upper bound of the largest `s` plaintext, which the restore pass holds in memory whole.
    var largestString: UInt64
    /// Bytes the restored vault, extras and the restore pass's temporary files can take at their peak.
    var disk: UInt64
    /// Bytes the restore pass writes before the old vault is removed: the first restored entry's
    /// payload copy and its plaintext, at most twice its payload. They need free space of their own.
    var scratch: UInt64
  }

  /// Every payload is re-encrypted into the vault (or moved out as an extra)
  /// at about its own size, and at the peak one entry's payload copy and
  /// plaintext sit in staging next to it; only the first restored entry's
  /// two files exist before the old vault is removed. The index extra is counted twice:
  /// JavaScript moves it into the SQLite folder after the native restore, and
  /// its first open writes a WAL beside it while the old index is still there.
  /// Each length is already bounded by the bytes left in the file, so the sums
  /// fit 64 bits. An `s` plaintext is at most its payload minus the stream header.
  static func restoreNeeds(_ layout: [EntryInfo]) -> RestoreNeeds {
    var total: UInt64 = 0
    var largest: UInt64 = 0
    var largestString: UInt64 = 0
    var index: UInt64 = 0
    var first: UInt64?
    for entry in layout where entry.meta.kind != "c" {
      if first == nil { first = entry.payloadLength }
      total += entry.payloadLength
      largest = max(largest, entry.payloadLength)
      if entry.meta.kind == "s" {
        largestString = max(largestString, entry.payloadLength > streamHeaderBytes ? entry.payloadLength - streamHeaderBytes : 0)
      }
      if entry.meta.kind == "x" && entry.meta.key == "database" { index += entry.payloadLength }
    }
    return RestoreNeeds(largestString: largestString, disk: total + 2 * largest + index, scratch: 2 * (first ?? 0))
  }

  /// Refuses an `s` entry whose `copies` whole copies would not fit in the
  /// memory the OS says is left. Unknown memory is not a refusal. This lowers
  /// the chance of the OS ending the restore after the wipe but cannot rule it
  /// out, because memory pressure can rise during the pass.
  static func checkMemory(bytes: UInt64, copies: Int, available: Int?) throws {
    guard bytes > 0, let available else { return }
    let (needed, overflow) = bytes.multipliedReportingOverflow(by: UInt64(copies))
    if overflow || needed > UInt64(max(0, available)) { throw BackupError.resource("an entry of \(bytes) bytes") }
  }

  /// The restore needs `needed` bytes; `free` are free now and the wipe gives
  /// back `freed` (the old vault's entries). `scratch` of them are written
  /// before the wipe, so they must fit in `free` alone. No margin is added: a
  /// device that fills up during the pass still ends as a partial restore.
  static func checkSpace(needed: UInt64, scratch: UInt64, free: UInt64, freed: UInt64) throws {
    if scratch > free { throw BackupError.noSpace(needed: Int64(clamping: scratch), available: Int64(clamping: free)) }
    let available = free &+ freed
    if needed > available { throw BackupError.noSpace(needed: Int64(clamping: needed), available: Int64(clamping: available)) }
  }

  /// Reads one entry's metadata and payload length, leaving `input` at the
  /// payload. Both lengths are checked against the bytes left in the file, and
  /// the meta length against the memory the OS says is left.
  private static func readEntryHead(_ input: FileHandle, index: Int, memory: MemoryProbe) throws -> (Meta, UInt64) {
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
  /// plaintext file to `handle`, which may move it; whatever `handle` leaves
  /// behind is removed when it returns, even by throwing. The second pass is not a
  /// transaction: once `handle` has started replacing the vault, a disk, I/O
  /// or key failure still leaves it partly restored; the caller reports that
  /// case separately.
  ///
  /// `validate` sees each entry's metadata on every pass; `validateAll` sees
  /// the whole list once, after the pre-pass and before the key is derived,
  /// for rules about which entries must be present. `preflight` sees the
  /// pre-pass layout once, after the verify pass and before the restore pass,
  /// so a device that cannot hold the restore refuses it with the vault
  /// untouched.
  ///
  /// Every payload copy and plaintext lives in `staging`, which is swept
  /// before anything is read (a staging error is thrown with the vault
  /// untouched) and again, best effort, when the read ends either way.
  ///
  /// `isCancelled` is asked once the key is derived (the KDF itself cannot be
  /// interrupted), before every entry of the verify pass, and before the
  /// preflight and the restore pass. A true answer throws
  /// `BackupError.cancelled` before `handle` has run. The last check, after
  /// the preflight, is `commit` instead: it answers false for a cancel already
  /// asked and otherwise marks the point passed in the same step, so a cancel
  /// can never be accepted after it. Nothing is asked once the restore pass
  /// has started, because `handle` may already have begun replacing the vault.
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
    // The last point a cancel is honoured: from here on `handle` may replace the vault.
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

  /// The check entry must decrypt to the fixed value; anything else means the
  /// passphrase is wrong.
  private static func verifyCheck(_ payload: URL, key: SymmetricKey, staging: StagingDirectory) throws {
    let plain = temporaryFile(in: staging)
    defer { try? FileManager.default.removeItem(at: plain) }
    do { try VaultCrypto.decryptFile(from: payload, to: plain, key: key) } catch { throw BackupError.passphrase }
    guard (try? Data(contentsOf: plain)) == checkValue else { throw BackupError.passphrase }
  }

  /// One pass over the container: each entry's metadata is validated again,
  /// its payload is copied to a temporary file that `visit` may read but not
  /// keep, and progress is reported per entry. `beforeEntry` runs before each
  /// entry is read and may throw to end the pass.
  private static func walk(
    _ source: URL, staging: StagingDirectory, validate: (Meta) throws -> Void, memory: MemoryProbe,
    progress: Progress, beforeEntry: () throws -> Void = {}, visit: (Meta, URL) throws -> Void
  ) throws {
    let input = try FileHandle(forReadingFrom: source)
    defer { try? input.close() }
    let header = try readHeader(input, memory: memory)
    for index in 0..<header.entries {
      try beforeEntry()
      // Lengths and metadata are checked again in case the file changed since the pre-pass.
      let (meta, size) = try readEntryHead(input, index: index, memory: memory)
      try validate(meta)
      let payload = temporaryFile(in: staging)
      defer { try? FileManager.default.removeItem(at: payload) }
      try copy(from: input, bytes: size, to: payload)
      try visit(meta, payload)
      progress(index + 1, header.entries)
    }
  }

  static func temporaryFile(in staging: StagingDirectory) -> URL {
    staging.url.appendingPathComponent("backup-\(UUID().uuidString)")
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
