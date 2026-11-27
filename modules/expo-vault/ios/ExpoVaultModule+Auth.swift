import ExpoModulesCore
import Foundation
import LocalAuthentication
import Security
import CryptoKit

extension ExpoVaultModule {
  func performCreateVault(promise: Promise) {
    var key = Data(count: 32)
    let result = key.withUnsafeMutableBytes {
      SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
    }

    if result != errSecSuccess {
      promise.reject("KEY_GENERATION_FAILED", "Failed to generate random key")
      return
    }

    // Invalidate prior LAContext so it cannot authorize the newly stored key.
    keySession.end()
    do {
      try VaultKeychain.storeNewKey(SymmetricKey(data: key), service: keychainService)
    } catch {
      promise.reject("KEYCHAIN_STORE_FAILED", "Failed to store key in keychain: \(error.localizedDescription)")
      return
    }

    promise.resolve(nil)
  }

  func performDeleteDeviceKey(promise: Promise) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
    ]
    let status = SecItemDelete(query as CFDictionary)
    keySession.end()
    if status == errSecSuccess || status == errSecItemNotFound {
      promise.resolve(nil)
    } else {
      promise.reject("KEYCHAIN_DELETE_FAILED", "The vault key could not be deleted: \(VaultKeychain.describe(status))")
    }
  }

  func performBiometryType(promise: Promise) {
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

  func performUnlockWithBiometrics(promise: Promise) {
    let context = LAContext()
    var error: NSError?

    if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
      let reason = "Unlock SecureVault to access your documents."
      context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
        if success {
          self.keySession.adopt(context)
          do {
            _ = try self.getEncryptionKey()
            promise.resolve(true)
          } catch {
            self.keySession.discard(context)
            promise.reject("KEY_RETRIEVAL_FAILED", error.localizedDescription)
          }
        } else if let laError = authenticationError as? LAError, Self.isUserDismissal(laError.code) {
          promise.resolve(false)
        } else {
          promise.reject(
            "BIOMETRIC_AUTH_FAILED",
            authenticationError?.localizedDescription ?? "Biometric authentication failed."
          )
        }
      }
    } else {
      promise.reject("BIOMETRIC_NOT_AVAILABLE", error?.localizedDescription ?? "Biometrics not available.")
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
}
