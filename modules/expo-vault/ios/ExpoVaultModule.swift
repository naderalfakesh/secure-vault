import CryptoKit
import ExpoModulesCore
import UIKit

public class ExpoVaultModule: Module {
  let keychainService = "com.naderalfakesh.securevault.vault"
  /// Peak copies of a string entry in restore (Data + sealed box + combined); never below 3.
  static let stringEntryCopies = 3
  private static let restoreSourceName = "restore-source"
  private static let sessionMarkerName = "securevault-session"
  /// Cleared on uninstall (unlike Keychain), distinguishing reinstall from update.
  private static let installMarkerKey = "com.naderalfakesh.securevault.installed"
  let restoreCancel = RestoreCancelFlag()
  /// Dedicated serial queue so large backup/restore I/O does not block Expo's shared module queue.
  private let vaultQueue = DispatchQueue(label: "com.naderalfakesh.securevault.vault-io", qos: .userInitiated)
  let keySession = VaultKeySession()

  public func definition() -> ModuleDefinition {
    Name("ExpoVault")

    Events("backupProgress")

    AsyncFunction("createVault") { (promise: Promise) in
      self.performCreateVault(promise: promise)
    }

    AsyncFunction("hasVault") { () -> Bool in
      VaultKeychain.protection(service: self.keychainService) != .none
    }

    AsyncFunction("keyProtection") { () -> String in
      VaultKeychain.protection(service: self.keychainService).rawValue
    }

    Function("endKeySession") { () in
      self.keySession.end()
    }

    Function("clipboardStamp") { () -> String? in
      return String(UIPasteboard.general.changeCount)
    }

    Function("hasInstallMarker") { () -> Bool in
      return UserDefaults.standard.bool(forKey: Self.installMarkerKey)
    }

    Function("setInstallMarker") { () in
      UserDefaults.standard.set(true, forKey: Self.installMarkerKey)
    }

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

    // Android-only no-ops; iOS suspends the app and dismisses share sheets on lock.
    Function("scheduleShareExpiry") { (_: String, _: Double) in }
    Function("lastStoppedAt") { () -> Double in 0 }
    Function("cancelShareExpiry") { (_: String) in }

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
