import CryptoKit
import ExpoModulesCore
import Foundation

extension ExpoVaultModule {
  func performExportBackup(
    destPath: String,
    passphrase: String,
    extraFiles: [[String: String]],
    stagingDir: String,
    promise: Promise
  ) {
    do {
      let caches = try FileManager.default.url(
        for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true
      )
      let staging = try BackupContainer.StagingDirectory(requested: stagingDir, caches: caches)
      let encryptionKey = try getEncryptionKey()
      var entries: [BackupContainer.Entry] = []
      for url in try vaultEntryURLs() {
        let kind = try Self.entryKind(at: url)
        entries.append(.init(key: url.lastPathComponent, kind: kind, source: .staged { plain in
          try self.decryptEntry(at: url, to: plain, key: encryptionKey)
        }))
      }
      for extra in extraFiles {
        guard let key = extra["key"], let path = extra["path"] else { continue }
        entries.append(.init(key: key, kind: "x", source: .file(URL(fileURLWithPath: path))))
      }
      let result = try BackupContainer.write(
        to: URL(fileURLWithPath: destPath), passphrase: passphrase, staging: staging, entries: entries
      ) { done, total in
        self.sendEvent("backupProgress", ["phase": "export", "done": done, "total": total])
      }
      promise.resolve(["entries": result.entries, "bytes": result.bytes])
    } catch let error as BackupContainer.StagingDirectoryError {
      promise.reject("BACKUP_STAGING_INVALID", error.localizedDescription)
    } catch {
      promise.reject("BACKUP_EXPORT_FAILED", error.localizedDescription)
    }
  }

  func performInspectBackup(sourcePath: String, promise: Promise) {
    do {
      let header = try BackupContainer.readHeader(from: URL(fileURLWithPath: sourcePath))
      promise.resolve([
        "version": header.version, "app": header.app, "created": header.created,
        "entries": max(0, header.entries - 1),
      ])
    } catch let error as BackupError {
      switch error {
      case .unsupported: promise.reject("BACKUP_UNSUPPORTED", error.localizedDescription)
      case .resource: promise.reject("BACKUP_RESOURCE", error.localizedDescription)
      default: promise.reject("BACKUP_INVALID", error.localizedDescription)
      }
    } catch {
      promise.reject("BACKUP_INVALID", error.localizedDescription)
    }
  }

  func performImportBackup(
    sourcePath: String,
    passphrase: String,
    extraDir: String,
    stagingDir: String,
    runId: String,
    promise: Promise
  ) {
    var cleared = false
    restoreCancel.start(runId)
    defer { restoreCancel.finish(runId) }
    do {
      let caches = try FileManager.default.url(
        for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true
      )
      let staging = try BackupContainer.StagingDirectory(
        requested: stagingDir, caches: caches, name: BackupContainer.StagingDirectory.restoreName
      )
      let encryptionKey = try getEncryptionKey()
      let source = URL(fileURLWithPath: sourcePath)
      let extras = URL(fileURLWithPath: extraDir, isDirectory: true)
      try FileManager.default.createDirectory(at: extras, withIntermediateDirectories: true)
      var restored: [[String: String]] = []
      var count = 0
      try BackupContainer.read(from: source, passphrase: passphrase, staging: staging, validate: { meta in
        guard Self.isRestoreKeyAllowed(meta) else { throw BackupError.corrupt("entry key \(meta.key)") }
      }, validateAll: { metas in
        guard Self.hasIndex(metas) else { throw BackupError.corrupt("no document index") }
      }, progress: { phase, done, total in
        self.sendEvent("backupProgress", ["phase": phase.rawValue, "done": done, "total": total])
      }, preflight: { layout in
        try self.preflightRestore(layout)
      }, isCancelled: {
        self.restoreCancel.isRequested
      }, commit: {
        self.restoreCancel.commit()
      }) { meta, plain in
        // Register cleanup before wiping so a wipe failure never leaves plaintext behind.
        defer { try? FileManager.default.removeItem(at: plain) }
        if !cleared {
          let previous = try self.vaultEntryURLs()
          cleared = true
          for url in previous { try FileManager.default.removeItem(at: url) }
        }
        switch meta.kind {
        case "s":
          let sealed = try AES.GCM.seal(Data(contentsOf: plain), using: encryptionKey)
          guard let combined = sealed.combined else { throw BackupError.corrupt("seal") }
          try combined.write(to: self.getFileURL(for: meta.key), options: .atomic)
        case "f":
          try VaultCrypto.encryptFile(from: plain, to: self.getFileURL(for: meta.key), key: encryptionKey)
        case "x":
          let target = try Self.contained(extras.appendingPathComponent(meta.key), in: extras)
          try? FileManager.default.removeItem(at: target)
          try FileManager.default.moveItem(at: plain, to: target)
          restored.append(["key": meta.key, "path": target.path])
        default:
          break
        }
        count += 1
      }
      promise.resolve(["entries": count, "extras": restored])
    } catch let error where cleared {
      promise.reject("BACKUP_PARTIAL", "The restore stopped after the previous vault was removed: \(error.localizedDescription)")
    } catch let error as BackupContainer.StagingDirectoryError {
      promise.reject("BACKUP_RESTORE_STAGING_INVALID", error.localizedDescription)
    } catch let error as BackupError {
      switch error {
      case .passphrase: promise.reject("BACKUP_PASSPHRASE", error.localizedDescription)
      case .unsupported: promise.reject("BACKUP_UNSUPPORTED", error.localizedDescription)
      case .corrupt: promise.reject("BACKUP_INVALID", error.localizedDescription)
      case .resource: promise.reject("BACKUP_RESOURCE", error.localizedDescription)
      case .noSpace: promise.reject("BACKUP_NO_SPACE", error.localizedDescription)
      case .cancelled: promise.reject("BACKUP_CANCELLED", error.localizedDescription)
      }
    } catch VaultKeyError.invalid(let key) {
      promise.reject("BACKUP_INVALID", VaultKeyError.invalid(key).localizedDescription)
    } catch {
      promise.reject("BACKUP_IMPORT_FAILED", error.localizedDescription)
    }
  }

  func preflightRestore(_ layout: [BackupContainer.EntryInfo]) throws {
    let needs = BackupContainer.restoreNeeds(layout)
    try BackupContainer.checkMemory(
      bytes: needs.largestString, copies: Self.stringEntryCopies, available: BackupContainer.availableMemory()
    )
    let directory = try FileManager.default.url(
      for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
    )
    let values = try directory.resourceValues(
      forKeys: [.volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey]
    )
    // volumeAvailableCapacityForImportantUsage includes system-purgeable space.
    let free = values.volumeAvailableCapacityForImportantUsage.map { Int64($0) }
      ?? values.volumeAvailableCapacity.map { Int64($0) }
    guard let free else { return }
    var freed: UInt64 = 0
    for url in try vaultEntryURLs() {
      freed += UInt64(try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
    }
    try BackupContainer.checkSpace(
      needed: needs.disk, scratch: needs.scratch, free: UInt64(max(0, free)), freed: freed
    )
  }
}
