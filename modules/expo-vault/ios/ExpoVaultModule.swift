import CryptoKit
import ExpoModulesCore
import UIKit

public class ExpoVaultModule: Module {
  let keychainService = "com.naderalfakesh.securevault.vault"
  /// Copies of an `s` plaintext the restore pass holds at once:
  /// `Data(contentsOf:)`, the sealed ciphertext and its `.combined` form.
  /// The same calls peaked at 2.0 times a 24 MiB plaintext in a host process
  /// (docs/verification/polish-round2.md); the third copy is headroom for a
  /// device, where it is not measured. Never below 3.
  static let stringEntryCopies = 3
  /// Folder in Documents the picked backup is moved into, so Caches purging cannot remove it.
  private static let restoreSourceName = "restore-source"
  /// Folder in Documents that holds the PIN and lockout markers.
  private static let sessionMarkerName = "securevault-session"
  /// UserDefaults flag for "this install has run". Deleting the app removes
  /// it, unlike the Keychain items, so its absence next to a device key
  /// tells a reinstall from an update.
  private static let installMarkerKey = "com.naderalfakesh.securevault.installed"
  /// The cancel request of the running restore, tied to its run id (see
  /// `RestoreCancelFlag`), so a cancel that lands after one restore ended can
  /// never stop the next one.
  let restoreCancel = RestoreCancelFlag()
  /// Every call that reads or writes vault entries runs here, one at a time,
  /// in the order JavaScript made them. Expo runs every module's async
  /// functions on one shared serial queue, so a restore or export of a large
  /// vault would otherwise hold up every other module's async call (the
  /// secure store's PIN read on the lock screen, the index queries) for as
  /// long as it runs. `cancelRestore` is synchronous and runs on the
  /// JavaScript thread, never behind the restore it stops.
  private let vaultQueue = DispatchQueue(label: "com.naderalfakesh.securevault.vault-io", qos: .userInitiated)
  /// The authenticated context every key read of the unlocked session uses.
  let keySession = VaultKeySession()

  public func definition() -> ModuleDefinition {
    Name("ExpoVault")

    Events("backupProgress")

    AsyncFunction("createVault") { (promise: Promise) in
      self.performCreateVault(promise: promise)
    }

    // Neither item is read, so this never prompts.
    AsyncFunction("hasVault") { () -> Bool in
      VaultKeychain.protection(service: self.keychainService) != .none
    }

    // "secure-enclave", "keychain", or "none" before a vault exists.
    AsyncFunction("keyProtection") { () -> String in
      VaultKeychain.protection(service: self.keychainService).rawValue
    }

    // The vault locked: the next key read prompts again. Synchronous, so it
    // lands before anything queued after the lock.
    Function("endKeySession") { () in
      self.keySession.end()
    }

    // Reading the count never reads the content, so it never prompts.
    Function("clipboardStamp") { () -> String? in
      return String(UIPasteboard.general.changeCount)
    }

    Function("hasInstallMarker") { () -> Bool in
      return UserDefaults.standard.bool(forKey: Self.installMarkerKey)
    }

    Function("setInstallMarker") { () in
      UserDefaults.standard.set(true, forKey: Self.installMarkerKey)
    }

    // Every item of the vault's service, whatever its account; no prompt,
    // since deleting an access-controlled item needs no authentication.
    AsyncFunction("deleteDeviceKey") { (promise: Promise) in
      self.performDeleteDeviceKey(promise: promise)
    }

    AsyncFunction("biometryType") { (promise: Promise) in
      self.performBiometryType(promise: promise)
    }

    AsyncFunction("unlockWithBiometrics") { (promise: Promise) in
      self.performUnlockWithBiometrics(promise: promise)
    }

    AsyncFunction("put") { (key: String, value: String, promise: Promise) in
      do {
        let encryptionKey = try self.getEncryptionKey()
        let sealedBox = try AES.GCM.seal(value.data(using: .utf8)!, using: encryptionKey)
        let fileURL = try self.getFileURL(for: key)
        // Atomic: a write cut short leaves the previous entry, never half a box.
        try sealedBox.combined?.write(to: fileURL, options: .atomic)
        promise.resolve(nil)
      } catch {
        promise.reject("PUT_FAILED", error.localizedDescription)
      }
    }
    .runOnQueue(vaultQueue)

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
    .runOnQueue(vaultQueue)

    // MARK: Passphrase-protected backups (see ExpoVaultModule+Backup.swift)

    AsyncFunction("exportBackup") { (destPath: String, passphrase: String, extraFiles: [[String: String]], stagingDir: String, promise: Promise) in
      self.performExportBackup(
        destPath: destPath, passphrase: passphrase, extraFiles: extraFiles, stagingDir: stagingDir, promise: promise
      )
    }
    .runOnQueue(vaultQueue)

    AsyncFunction("inspectBackup") { (sourcePath: String, promise: Promise) in
      self.performInspectBackup(sourcePath: sourcePath, promise: promise)
    }
    .runOnQueue(vaultQueue)

    // Cooperative cancel tied to `runId` (see `RestoreCancelFlag`).
    Function("cancelRestore") { (runId: String) -> Bool in
      self.restoreCancel.request(runId)
    }

    AsyncFunction("importBackup") { (sourcePath: String, passphrase: String, extraDir: String, stagingDir: String, runId: String, promise: Promise) in
      self.performImportBackup(
        sourcePath: sourcePath, passphrase: passphrase, extraDir: extraDir,
        stagingDir: stagingDir, runId: runId, promise: promise
      )
    }
    .runOnQueue(vaultQueue)

    AsyncFunction("getAllKeys") { (promise: Promise) in
      do {
        promise.resolve(try self.vaultEntryURLs().map { $0.lastPathComponent })
      } catch {
        promise.reject("GET_ALL_KEYS_FAILED", error.localizedDescription)
      }
    }
    .runOnQueue(vaultQueue)

    AsyncFunction("delete") { (key: String, promise: Promise) in
      do {
        let fileURL = try self.getFileURL(for: key)
        try FileManager.default.removeItem(at: fileURL)
        promise.resolve(nil)
      } catch {
        promise.reject("DELETE_FAILED", error.localizedDescription)
      }
    }
    .runOnQueue(vaultQueue)

    // MARK: File-based encryption

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
    .runOnQueue(vaultQueue)

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
    .runOnQueue(vaultQueue)

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
    .runOnQueue(vaultQueue)

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
    .runOnQueue(vaultQueue)

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
    .runOnQueue(vaultQueue)

    // Closes a share sheet left up when the vault locks, so it never sits over
    // the lock screen with its preview.
    AsyncFunction("dismissShareSheet") { () -> Bool in
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
    Function("lastStoppedAt") { () -> Double in 0 }
    Function("cancelShareExpiry") { (_: String) in }

    // Keeps one of the app's own Documents folders out of iCloud and iTunes backups.
    Function("excludeFromBackup") { (path: String) throws in
      let documents = try FileManager.default.url(
        for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
      )
      var url = URL(fileURLWithPath: path).standardizedFileURL
      let parent = url.deletingLastPathComponent().resolvingSymlinksInPath().path
      guard parent == documents.standardizedFileURL.resolvingSymlinksInPath().path,
        [Self.restoreSourceName, Self.sessionMarkerName].contains(url.lastPathComponent)
      else {
        throw BackupContainer.RemovalError(reason: "not one of the app's own folders")
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }

    Function("removeTreeNoFollow") { (path: String) throws in
      let caches = try FileManager.default.url(
        for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true
      )
      let documents = try FileManager.default.url(
        for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true
      )
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
    .runOnQueue(vaultQueue)
  }
}
