import Foundation

extension BackupContainer {
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

  static func temporaryFile(in staging: StagingDirectory) -> URL {
    staging.url.appendingPathComponent("backup-\(UUID().uuidString)")
  }
}
