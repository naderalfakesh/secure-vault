import ExpoModulesCore
import Security
import LocalAuthentication
import CryptoKit

public class ExpoVaultModule: Module {
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
        .biometryCurrentSet,
        nil
      )!

      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "encryptionKey",
        kSecAttrService as String: "com.example.ExpoCryptoVault",
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

    AsyncFunction("unlockWithBiometrics") { (promise: Promise) in
      let context = LAContext()
      var error: NSError?

      if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
        let reason = "Unlock your vault to access your notes."
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authenticationError in
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
  }

  private func getEncryptionKey() throws -> SymmetricKey {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "encryptionKey",
        kSecAttrService as String: "com.example.ExpoCryptoVault",
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
