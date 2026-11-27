import Foundation

extension BackupContainer {
  struct StagingDirectoryError: LocalizedError {
    let reason: String
    var errorDescription: String? { "The backup staging folder is not allowed: \(reason)" }
  }

  struct StagingDirectory {
    static let name = "backup-staging"
    static let restoreName = "restore-staging"
    let url: URL

    init(requested: String, caches: URL, name: String = StagingDirectory.name) throws {
      guard requested.hasPrefix("/") else { throw StagingDirectoryError(reason: "not an absolute path") }
      let candidate = URL(fileURLWithPath: requested, isDirectory: true).standardizedFileURL
      // attributesOfItem does not follow symlinks, rejecting a symlink even if its target matches.
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

  static func sweep(_ staging: StagingDirectory) throws {
    let fileManager = FileManager.default
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
    // attributesOfItem does not follow symlinks, so dangling links are still unlinked.
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
