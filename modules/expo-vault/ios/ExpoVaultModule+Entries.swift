import CryptoKit
import Foundation

extension ExpoVaultModule {
  func getEncryptionKey() throws -> SymmetricKey {
    let context = keySession.current()
    if let key = keySession.key(for: context) { return key }
    do {
      let key = try VaultKeychain.loadKey(service: keychainService, context: context)
      keySession.remember(key, for: context)
      return key
    } catch {
      // A cancelled or failed prompt leaves the context unauthenticated;
      // keeping it would make every later read fail without asking.
      keySession.discard(context)
      throw error
    }
  }

  /// Only names the vault itself writes count as entries: document files,
  /// thumbnails, pages, and the underscore-prefixed metadata entries. The
  /// Documents directory also holds the SQLite folder.
  static func isVaultEntryName(_ name: String) -> Bool {
    name.hasPrefix("file_") || name.hasPrefix("thumb_") || name.hasPrefix("page_") || name.hasPrefix("_")
  }

  /// Approved key grammar: one path component, no separators or "..", with
  /// one of the vault's own prefixes. Checked before any path is built.
  static func isVaultKey(_ key: String) -> Bool {
    !key.isEmpty && !key.contains("/") && !key.contains("\\") && !key.contains("..")
      && isVaultEntryName(key)
  }

  /// Restore entries: the index extra is exactly "database"; string and file
  /// entries are vault keys; the check entry is "_check". The container
  /// refuses every other kind in its pre-pass already; refusing it here as
  /// well keeps an unknown kind from ever reaching the importer.
  static func isRestoreKeyAllowed(_ meta: BackupContainer.Meta) -> Bool {
    switch meta.kind {
    case "x": return meta.key == "database"
    case "s", "f": return isVaultKey(meta.key)
    case "c": return meta.key == "_check"
    default: return false
    }
  }

  /// The restore in JavaScript replaces the SQLite index with the "database"
  /// extra and opens it with the "_database_key" string entry (see
  /// `src/data/store/constants.ts`). Every backup the app has written carries both;
  /// one without them would be refused in JavaScript only after the vault had
  /// been cleared, so it is refused here, before anything is derived or removed.
  static func hasIndex(_ metas: [BackupContainer.Meta]) -> Bool {
    metas.filter { $0.kind == "x" && $0.key == "database" }.count == 1
      && metas.contains { $0.kind == "s" && $0.key == "_database_key" }
  }

  /// Second line of defence after the grammar: the resolved path must stay
  /// inside `directory`.
  static func contained(_ target: URL, in directory: URL) throws -> URL {
    var base = directory.resolvingSymlinksInPath().path
    if !base.hasSuffix("/") { base += "/" }
    guard target.resolvingSymlinksInPath().path.hasPrefix(base) else {
      throw VaultKeyError.invalid(target.lastPathComponent)
    }
    return target
  }

  /// Regular files that are vault entries, in a stable order. An entry whose
  /// type cannot be read throws instead of being dropped, so a name missing
  /// from the list always means a missing file.
  func vaultEntryURLs() throws -> [URL] {
    let directory = try FileManager.default.url(
      for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
    )
    return try FileManager.default
      .contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isRegularFileKey])
      .filter { url in
        try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true
          && Self.isVaultEntryName(url.lastPathComponent)
      }
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
  }

  /// An entry's kind from its first bytes, without decrypting it: "f" for the
  /// chunked file container, "s" for a single sealed box.
  static func entryKind(at url: URL) throws -> String {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }
    return input.readData(ofLength: 4) == Data("SVC1".utf8) ? "f" : "s"
  }

  /// Decrypts one vault entry with the device key into `plain`.
  func decryptEntry(at url: URL, to plain: URL, key: SymmetricKey) throws {
    if try Self.entryKind(at: url) == "f" {
      try VaultCrypto.decryptFile(from: url, to: plain, key: key)
      return
    }
    let box = try AES.GCM.SealedBox(combined: Data(contentsOf: url))
    // Written in place: an atomic write may stage its auxiliary copy outside
    // the swept folder, and `plain` is a fresh name that nothing else reads.
    try AES.GCM.open(box, using: key).write(to: plain)
  }

  func getFileURL(for key: String) throws -> URL {
    guard Self.isVaultKey(key) else { throw VaultKeyError.invalid(key) }
    let directory = try FileManager.default
      .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    return try Self.contained(directory.appendingPathComponent(key), in: directory)
  }
}
