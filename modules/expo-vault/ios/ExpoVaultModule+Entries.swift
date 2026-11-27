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
      // Discard unauthenticated context so future reads re-prompt instead of failing silently.
      keySession.discard(context)
      throw error
    }
  }

  static func isVaultEntryName(_ name: String) -> Bool {
    name.hasPrefix("file_") || name.hasPrefix("thumb_") || name.hasPrefix("page_") || name.hasPrefix("_")
  }

  static func isVaultKey(_ key: String) -> Bool {
    !key.isEmpty && !key.contains("/") && !key.contains("\\") && !key.contains("..")
      && isVaultEntryName(key)
  }

  static func isRestoreKeyAllowed(_ meta: BackupContainer.Meta) -> Bool {
    switch meta.kind {
    case "x": return meta.key == "database"
    case "s", "f": return isVaultKey(meta.key)
    case "c": return meta.key == "_check"
    default: return false
    }
  }

  static func hasIndex(_ metas: [BackupContainer.Meta]) -> Bool {
    metas.filter { $0.kind == "x" && $0.key == "database" }.count == 1
      && metas.contains { $0.kind == "s" && $0.key == "_database_key" }
  }

  static func contained(_ target: URL, in directory: URL) throws -> URL {
    var base = directory.resolvingSymlinksInPath().path
    if !base.hasSuffix("/") { base += "/" }
    guard target.resolvingSymlinksInPath().path.hasPrefix(base) else {
      throw VaultKeyError.invalid(target.lastPathComponent)
    }
    return target
  }

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

  static func entryKind(at url: URL) throws -> String {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }
    return input.readData(ofLength: 4) == Data("SVC1".utf8) ? "f" : "s"
  }

  func decryptEntry(at url: URL, to plain: URL, key: SymmetricKey) throws {
    if try Self.entryKind(at: url) == "f" {
      try VaultCrypto.decryptFile(from: url, to: plain, key: key)
      return
    }
    let box = try AES.GCM.SealedBox(combined: Data(contentsOf: url))
    // Write directly rather than .atomic so no auxiliary copy is staged outside the swept folder.
    try AES.GCM.open(box, using: key).write(to: plain)
  }

  func getFileURL(for key: String) throws -> URL {
    guard Self.isVaultKey(key) else { throw VaultKeyError.invalid(key) }
    let directory = try FileManager.default
      .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    return try Self.contained(directory.appendingPathComponent(key), in: directory)
  }
}
