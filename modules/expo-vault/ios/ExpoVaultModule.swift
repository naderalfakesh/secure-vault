import ExpoModulesCore
import Security
import LocalAuthentication
import CryptoKit

public class ExpoVaultModule: Module {
  private let keychainService = "com.naderalfakesh.securevault.vault"

  public func definition() -> ModuleDefinition {
    Name("ExpoVault")

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
        kSecAttrAccount as String: "encryptionKey",
        kSecAttrService as String: keychainService,
        kSecValueData as String: key,
        kSecAttrAccessControl as String: accessControl
      ]

      // First, delete any existing key with the same identifier
      SecItemDelete(query as CFDictionary)

      let status = SecItemAdd(query as CFDictionary, nil)
      if status != errSecSuccess {
        promise.reject("KEYCHAIN_STORE_FAILED", "Failed to store key in keychain: \(status)")
        return
      }

      promise.resolve(nil)
    }

    AsyncFunction("hasVault") { (promise: Promise) in
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "encryptionKey",
        kSecAttrService as String: self.keychainService,
        kSecReturnData as String: false,
        kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail
      ]
      let status = SecItemCopyMatching(query as CFDictionary, nil)
      // The item is access-controlled, so an interaction-required status still
      // means the key exists; only "not found" means there is no vault yet.
      promise.resolve(status != errSecItemNotFound)
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

    AsyncFunction("exportEncrypted") { (promise: Promise) in
        do {
            let fileManager = FileManager.default
            let documentsURL = try fileManager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            let fileURLs = try fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)

            var exportedData: [String: String] = [:]
            for fileURL in fileURLs {
                let fileName = fileURL.lastPathComponent
                let fileData = try Data(contentsOf: fileURL)
                exportedData[fileName] = fileData.base64EncodedString()
            }

            let jsonData = try JSONSerialization.data(withJSONObject: exportedData, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8)
            promise.resolve(jsonString)
        } catch {
            promise.reject("EXPORT_FAILED", error.localizedDescription)
        }
    }

    AsyncFunction("importEncrypted") { (jsonString: String, promise: Promise) in
        do {
            guard let jsonData = jsonString.data(using: .utf8) else {
                throw NSError(domain: "ExpoVault", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON string"])
            }

            guard let importedData = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: String] else {
                throw NSError(domain: "ExpoVault", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON format"])
            }

            let fileManager = FileManager.default
            let documentsURL = try fileManager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)

            // Clear existing notes before importing
            let existingFiles = try fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
            for fileURL in existingFiles {
                try fileManager.removeItem(at: fileURL)
            }

            for (fileName, base64String) in importedData {
                guard let fileData = Data(base64Encoded: base64String) else {
                    // Skip invalid base64 strings
                    continue
                }
                let fileURL = documentsURL.appendingPathComponent(fileName)
                try fileData.write(to: fileURL)
            }

            promise.resolve(nil)
        } catch {
            promise.reject("IMPORT_FAILED", error.localizedDescription)
        }
    }

    AsyncFunction("getAllKeys") { (promise: Promise) in
        do {
            let fileManager = FileManager.default
            let documentsURL = try fileManager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            let fileURLs = try fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
            let keys = fileURLs.map { $0.lastPathComponent }
            promise.resolve(keys)
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

  private func getEncryptionKey() throws -> SymmetricKey {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "encryptionKey",
        kSecAttrService as String: keychainService,
        kSecReturnData as String: true
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    guard status == errSecSuccess, let keyData = item as? Data else {
        throw NSError(domain: "ExpoVault", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Failed to retrieve key from keychain"])
    }

    return SymmetricKey(data: keyData)
  }

  private func getFileURL(for key: String) throws -> URL {
    try FileManager.default
        .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        .appendingPathComponent(key)
  }
}
