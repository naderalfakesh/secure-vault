import ExpoModulesCore
import UIKit
import Security
import LocalAuthentication
import CryptoKit

public class ExpoVaultModule: Module {
  private let keychainService = "com.naderalfakesh.securevault.vault"
  /// Copies of an `s` plaintext the restore pass holds at once:
  /// `Data(contentsOf:)`, the sealed ciphertext and its `.combined` form.
  /// The same calls peaked at 2.0 times a 24 MiB plaintext in a host process
  /// (docs/verification/polish-round2.md); the third copy is headroom for a
  /// device, where it is not measured. Never below 3.
  private static let stringEntryCopies = 3
  /// Folder in Documents the picked backup is moved into, so Caches purging cannot remove it.
  private static let restoreSourceName = "restore-source"
  /// Set by `cancelRestore`, read by the running restore between entries of
  /// its checking pass. `importBackup` clears it when it starts, so a cancel
  /// that arrived after an earlier restore ended cannot stop the next one; the
  /// JavaScript caller repeats a cancel on the restore's first progress event
  /// in case it landed before that.
  private let restoreCancel = RestoreCancelFlag()

  public func definition() -> ModuleDefinition {
    Name("ExpoVault")

    Events("backupProgress")

    AsyncFunction("createVault") { (promise: Promise) in
      var key = Data(count: 32)
      let result = key.withUnsafeMutableBytes {
        SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
      }

      if result != errSecSuccess {
        promise.reject("KEY_GENERATION_FAILED", "Failed to generate random key")
        return
      }

      let accessControl = SecAccessControlCreateWithFlags(
        kCFAllocatorDefault,
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        .userPresence,
        nil
      )!

      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: VaultKeychain.account,
        kSecAttrService as String: keychainService,
        kSecValueData as String: key,
        kSecAttrAccessControl as String: accessControl
      ]

      // First, delete any existing key with the same identifier
      SecItemDelete(query as CFDictionary)

      let status = SecItemAdd(query as CFDictionary, nil)
      if status != errSecSuccess {
        promise.reject("KEYCHAIN_STORE_FAILED", "Failed to store key in keychain: \(VaultKeychain.describe(status))")
        return
      }

      promise.resolve(nil)
    }

    AsyncFunction("hasVault") { (promise: Promise) in
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: VaultKeychain.account,
        kSecAttrService as String: self.keychainService,
        kSecReturnData as String: false,
        kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail
      ]
      let status = SecItemCopyMatching(query as CFDictionary, nil)
      // The item is access-controlled, so an interaction-required status still
      // means the key exists; only "not found" means there is no vault yet.
      promise.resolve(status != errSecItemNotFound)
    }

    AsyncFunction("biometryType") { (promise: Promise) in
      let context = LAContext()
      var error: NSError?
      guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        promise.resolve("none")
        return
      }
      switch context.biometryType {
      case .faceID: promise.resolve("faceId")
      case .touchID: promise.resolve("touchId")
      default: promise.resolve("biometrics")
      }
    }

    AsyncFunction("unlockWithBiometrics") { (promise: Promise) in
      let context = LAContext()
      var error: NSError?

      if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
        let reason = "Unlock SecureVault to access your documents."
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
          if success {
            do {
              _ = try self.getEncryptionKey()
              promise.resolve(true)
            } catch {
              promise.reject("KEY_RETRIEVAL_FAILED", error.localizedDescription)
            }
          } else if let laError = authenticationError as? LAError, Self.isUserDismissal(laError.code) {
            // Cancelling the prompt is a choice, not a failure: the caller
            // falls back to the PIN without showing an error.
            promise.resolve(false)
          } else {
            promise.reject("BIOMETRIC_AUTH_FAILED", authenticationError?.localizedDescription ?? "Biometric authentication failed.")
          }
        }
      } else {
        promise.reject("BIOMETRIC_NOT_AVAILABLE", error?.localizedDescription ?? "Biometrics not available.")
      }
    }

    AsyncFunction("put") { (key: String, value: String, promise: Promise) in
        do {
            let encryptionKey = try self.getEncryptionKey()
            let sealedBox = try AES.GCM.seal(value.data(using: .utf8)!, using: encryptionKey)

            let fileURL = try self.getFileURL(for: key)
            try sealedBox.combined?.write(to: fileURL)
            promise.resolve(nil)
        } catch {
            promise.reject("PUT_FAILED", error.localizedDescription)
        }
    }

    AsyncFunction("get") { (key: String, promise: Promise) in
        do {
            let encryptionKey = try self.getEncryptionKey()
            let fileURL = try self.getFileURL(for: key)

            let sealedBoxData = try Data(contentsOf: fileURL)
            let sealedBox = try AES.GCM.SealedBox(combined: sealedBoxData)
            let decryptedData = try AES.GCM.open(sealedBox, using: encryptionKey)

            promise.resolve(String(data: decryptedData, encoding: .utf8))
        } catch {
            promise.reject("GET_FAILED", error.localizedDescription)
        }
    }

    // MARK: Passphrase-protected backups (see BackupContainer.swift)

    AsyncFunction("exportBackup") { (destPath: String, passphrase: String, extraFiles: [[String: String]], stagingDir: String, promise: Promise) in
        do {
            // Checked before anything is swept or written: only the app's own
            // backup-staging cache folder may hold export plaintext.
            let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let staging = try BackupContainer.StagingDirectory(requested: stagingDir, caches: caches)
            let encryptionKey = try self.getEncryptionKey()
            var entries: [BackupContainer.Entry] = []
            for url in try self.vaultEntryURLs() {
                // Only the kind is read here; the container decrypts each entry
                // into the staging directory when its turn comes.
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

    AsyncFunction("inspectBackup") { (sourcePath: String, promise: Promise) in
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

    // Asks the running restore to stop before it removes anything. It is
    // cooperative: the restore checks the flag between entries while it is
    // still checking, so a cancel during the key derivation takes effect once
    // that ends, and one after the checking pass has no effect at all. Returns
    // at once; the restore rejects with BACKUP_CANCELLED if it stopped.
    Function("cancelRestore") {
        self.restoreCancel.request()
    }

    AsyncFunction("importBackup") { (sourcePath: String, passphrase: String, extraDir: String, stagingDir: String, promise: Promise) in
        var cleared = false
        self.restoreCancel.reset()
        do {
            // Decrypted entries may only land in the app's restore-staging cache folder.
            let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let staging = try BackupContainer.StagingDirectory(
                requested: stagingDir, caches: caches, name: BackupContainer.StagingDirectory.restoreName
            )
            let encryptionKey = try self.getEncryptionKey()
            let source = URL(fileURLWithPath: sourcePath)
            let extras = URL(fileURLWithPath: extraDir, isDirectory: true)
            try FileManager.default.createDirectory(at: extras, withIntermediateDirectories: true)
            // Every key is checked and every entry decrypted once before the
            // first entry is handled; the vault is only cleared after both.
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
            }) { meta, plain in
                // Registered first, so a wipe failure cannot leave the decrypted entry behind.
                defer { try? FileManager.default.removeItem(at: plain) }
                if !cleared {
                    let previous = try self.vaultEntryURLs()
                    // From the first removal on, a failure is a partial restore.
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
            // Every entry had already decrypted once, so a failure after the wipe
            // is usually disk, I/O or the key, not the file; it is named either
            // way, because the old vault is gone.
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
            // Includes the keychain refusing the device key, which is not the file's fault.
            promise.reject("BACKUP_IMPORT_FAILED", error.localizedDescription)
        }
    }

    AsyncFunction("getAllKeys") { (promise: Promise) in
        do {
            promise.resolve(try self.vaultEntryURLs().map { $0.lastPathComponent })
        } catch {
            promise.reject("GET_ALL_KEYS_FAILED", error.localizedDescription)
        }
    }

    AsyncFunction("delete") { (key: String, promise: Promise) in
        do {
            let fileURL = try self.getFileURL(for: key)
            try FileManager.default.removeItem(at: fileURL)
            promise.resolve(nil)
        } catch {
            promise.reject("DELETE_FAILED", error.localizedDescription)
        }
    }

    // File-based encryption methods for binary data (images, PDFs, etc.)

    AsyncFunction("putFile") { (key: String, sourcePath: String, promise: Promise) in
        do {
            let encryptionKey = try self.getEncryptionKey()
            let sourceURL = URL(fileURLWithPath: sourcePath)
            let destURL = try self.getFileURL(for: key)
            try VaultCrypto.encryptFile(from: sourceURL, to: destURL, key: encryptionKey)
            promise.resolve(nil)
        } catch {
            promise.reject("PUT_FILE_FAILED", "Failed to encrypt file: \(error.localizedDescription)")
        }
    }

    AsyncFunction("putThumbnail") { (key: String, sourcePath: String, maxPixelSize: Int, promise: Promise) in
        do {
            let encryptionKey = try self.getEncryptionKey()
            let jpeg = try VaultCrypto.thumbnailJPEG(from: URL(fileURLWithPath: sourcePath), maxPixelSize: maxPixelSize)
            try VaultCrypto.encryptData(jpeg, to: self.getFileURL(for: key), key: encryptionKey)
            promise.resolve(nil)
        } catch {
            promise.reject("PUT_THUMBNAIL_FAILED", "Failed to create thumbnail: \(error.localizedDescription)")
        }
    }

    AsyncFunction("renderPdfPages") { (sourcePath: String, maxPixelSize: Int, destDir: String, promise: Promise) in
        do {
            let pages = try PdfPages.render(
                from: URL(fileURLWithPath: sourcePath),
                maxPixelSize: maxPixelSize,
                into: URL(fileURLWithPath: destDir, isDirectory: true)
            )
            promise.resolve(pages)
        } catch {
            promise.reject("RENDER_PDF_FAILED", "Failed to render the PDF: \(error.localizedDescription)")
        }
    }

    AsyncFunction("getFile") { (key: String, destPath: String, promise: Promise) in
        do {
            let encryptionKey = try self.getEncryptionKey()
            let encryptedURL = try self.getFileURL(for: key)
            let destURL = URL(fileURLWithPath: destPath)
            try VaultCrypto.decryptFile(from: encryptedURL, to: destURL, key: encryptionKey)
            promise.resolve(destPath)
        } catch {
            promise.reject("GET_FILE_FAILED", "Failed to decrypt file: \(error.localizedDescription)")
        }
    }

    AsyncFunction("deleteFile") { (key: String, promise: Promise) in
        do {
            let fileURL = try self.getFileURL(for: key)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                try FileManager.default.removeItem(at: fileURL)
            }
            promise.resolve(nil)
        } catch {
            promise.reject("DELETE_FILE_FAILED", "Failed to delete file: \(error.localizedDescription)")
        }
    }

    // Closes a share sheet left up when the vault locks, so it never sits over
    // the lock screen with its preview. Dismissing the sheet's presenter also
    // closes anything the sheet presented (Mail, Save to Files). Resolves true
    // when a sheet was found.
    AsyncFunction("dismissShareSheet") { () -> Bool in
      // Runs on the main queue (below), where UIKit may be used.
      MainActor.assumeIsolated {
        let roots = UIApplication.shared.connectedScenes
          .compactMap { $0 as? UIWindowScene }
          .flatMap { $0.windows }
          .compactMap { $0.rootViewController }
        for root in roots {
          var presenter = root
          while let presented = presenter.presentedViewController {
            if presented is UIActivityViewController {
              presenter.dismiss(animated: false)
              return true
            }
            presenter = presented
          }
        }
        return false
      }
    }
    .runOnQueue(.main)

    // Android only: its chooser pauses the app while JavaScript timers stop.
    // iOS suspends the whole app instead, and the lock path dismisses the sheet.
    Function("scheduleShareExpiry") { (_: String, _: Double) in }
    Function("cancelShareExpiry") { (_: String) in }

    // Mirrors Android, where expo-file-system's delete follows a link.
    Function("removeTreeNoFollow") { (path: String) throws in
      let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      try BackupContainer.removeNoFollow(
        path,
        roots: [caches, FileManager.default.temporaryDirectory],
        exact: [documents.appendingPathComponent(Self.restoreSourceName)]
      )
    }

    AsyncFunction("getFileSize") { (key: String, promise: Promise) in
        do {
            let fileURL = try self.getFileURL(for: key)
            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            if let fileSize = attributes[.size] as? NSNumber {
                promise.resolve(fileSize.doubleValue)
            } else {
                promise.reject("GET_FILE_SIZE_FAILED", "Could not determine file size")
            }
        } catch {
            promise.reject("GET_FILE_SIZE_FAILED", error.localizedDescription)
        }
    }
  }

  private static func isUserDismissal(_ code: LAError.Code) -> Bool {
    switch code {
    case .userCancel, .systemCancel, .appCancel, .userFallback:
      return true
    default:
      return false
    }
  }

  private func getEncryptionKey() throws -> SymmetricKey {
    try VaultKeychain.loadKey(service: keychainService)
  }

  /// Only names the vault itself writes count as entries: document files,
  /// thumbnails, pages, and the underscore-prefixed metadata entries. The
  /// Documents directory also holds the SQLite folder.
  private static func isVaultEntryName(_ name: String) -> Bool {
    name.hasPrefix("file_") || name.hasPrefix("thumb_") || name.hasPrefix("page_") || name.hasPrefix("_")
  }

  /// Approved key grammar: one path component, no separators or "..", with
  /// one of the vault's own prefixes. Checked before any path is built.
  private static func isVaultKey(_ key: String) -> Bool {
    !key.isEmpty && !key.contains("/") && !key.contains("\\") && !key.contains("..")
      && isVaultEntryName(key)
  }

  /// Restore entries: the index extra is exactly "database"; string and file
  /// entries are vault keys; the check entry is "_check". The container
  /// refuses every other kind in its pre-pass already; refusing it here as
  /// well keeps an unknown kind from ever reaching the importer.
  private static func isRestoreKeyAllowed(_ meta: BackupContainer.Meta) -> Bool {
    switch meta.kind {
    case "x": return meta.key == "database"
    case "s", "f": return isVaultKey(meta.key)
    case "c": return meta.key == "_check"
    default: return false
    }
  }

  /// The restore in JavaScript replaces the SQLite index with the "database"
  /// extra and opens it with the "_database_key" string entry (see
  /// `src/data/database.ts`). Every backup the app has written carries both;
  /// one without them would be refused in JavaScript only after the vault had
  /// been cleared, so it is refused here, before anything is derived or removed.
  private static func hasIndex(_ metas: [BackupContainer.Meta]) -> Bool {
    metas.filter { $0.kind == "x" && $0.key == "database" }.count == 1
      && metas.contains { $0.kind == "s" && $0.key == "_database_key" }
  }

  /// Runs after every entry has decrypted once and before the vault is
  /// cleared. The largest `s` entry, held whole in memory three times over,
  /// must fit in what the OS says the process can still use, and the restored
  /// vault plus the pass's temporary files must fit in the free space plus
  /// what the old vault's entries give back, with the files written before
  /// the wipe in the free space alone. A figure the OS does not give is
  /// not a refusal. Either refusal leaves the vault untouched.
  private func preflightRestore(_ layout: [BackupContainer.EntryInfo]) throws {
    let needs = BackupContainer.restoreNeeds(layout)
    try BackupContainer.checkMemory(
      bytes: needs.largestString, copies: Self.stringEntryCopies, available: BackupContainer.availableMemory()
    )
    let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let values = try directory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey])
    // The figure for user-requested work counts space the system can purge on demand.
    let free = values.volumeAvailableCapacityForImportantUsage.map { Int64($0) } ?? values.volumeAvailableCapacity.map { Int64($0) }
    guard let free else { return }
    var freed: UInt64 = 0
    for url in try vaultEntryURLs() {
      freed += UInt64(try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
    }
    try BackupContainer.checkSpace(needed: needs.disk, scratch: needs.scratch, free: UInt64(max(0, free)), freed: freed)
  }

  /// Second line of defence after the grammar: the resolved path must stay
  /// inside `directory`.
  private static func contained(_ target: URL, in directory: URL) throws -> URL {
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
  private func vaultEntryURLs() throws -> [URL] {
    let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
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
  private static func entryKind(at url: URL) throws -> String {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }
    return input.readData(ofLength: 4) == Data("SVC1".utf8) ? "f" : "s"
  }

  /// Decrypts one vault entry with the device key into `plain`.
  private func decryptEntry(at url: URL, to plain: URL, key: SymmetricKey) throws {
    if try Self.entryKind(at: url) == "f" {
      try VaultCrypto.decryptFile(from: url, to: plain, key: key)
      return
    }
    let box = try AES.GCM.SealedBox(combined: Data(contentsOf: url))
    // Written in place: an atomic write may stage its auxiliary copy outside
    // the swept folder, and `plain` is a fresh name that nothing else reads.
    try AES.GCM.open(box, using: key).write(to: plain)
  }

  private func getFileURL(for key: String) throws -> URL {
    guard Self.isVaultKey(key) else { throw VaultKeyError.invalid(key) }
    let directory = try FileManager.default
        .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    return try Self.contained(directory.appendingPathComponent(key), in: directory)
  }
}
