# ExpoCryptoVault: A Local-First Encrypted Notes Vault

This project is a secure, local-first encrypted notes vault built with React Native and Expo. It demonstrates advanced skills in integrating native modules with Expo, handling cryptographic operations, and utilizing biometric authentication for enhanced security.

## Features

-   **Local-First:** All your notes are stored encrypted on your device.
-   **Secure:** Uses AES-GCM encryption to protect your notes. The encryption key is stored securely in the device's Keychain (iOS) or Keystore (Android).
-   **Biometric Authentication:** Access to the encryption key is protected by Face ID or Touch ID.
-   **Cross-Platform:** Works on both iOS and Android.
-   **Export/Import:** You can export your encrypted notes to a JSON file and import them on another device.

## Getting Started

### Prerequisites

-   Node.js and npm
-   Expo CLI
-   Xcode for iOS development
-   Android Studio for Android development

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/ExpoCryptoVault.git
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Run the app:
    -   For iOS:
        ```bash
        npx expo run:ios
        ```
    -   For Android:
        ```bash
        npx expo run:android
        ```

## Project Overview

ExpoCryptoVault is designed to provide a secure and private note-taking experience by keeping all data encrypted and stored locally on the user's device. The application leverages native device capabilities for strong encryption and biometric authentication, ensuring that sensitive information remains protected.

The architecture is divided into several key components:

1.  **React Native Application:** The frontend user interface, built with React Native and managed by Expo, provides a seamless cross-platform experience. It includes screens for vault management (locked/unlocked states), note listing, note detail editing, and settings for data export/import.
2.  **Native Module (`ExpoVault`):** This is the core of the security features. Implemented in Swift for iOS and Kotlin for Android, this module exposes functions to the JavaScript layer for:
    *   **Key Management:** Generating and securely storing AES-GCM encryption keys in the platform-specific secure storage (Keychain on iOS, Android Keystore on Android).
    *   **Biometric Authentication:** Interfacing with Face ID/Touch ID (iOS) or BiometricPrompt (Android) to authenticate the user before accessing the encryption key.
    *   **Cryptographic Operations:** Performing AES-GCM encryption and decryption of note content.
    *   **File Management:** Reading and writing encrypted note data to the device's local storage.
    *   **Vault Backup/Restore:** Exporting all encrypted notes as a single JSON string and importing them back.
3.  **Expo Config Plugin:** A custom plugin automates the configuration of native project settings, such as adding necessary permissions and usage descriptions for biometrics, ensuring proper integration with the Expo ecosystem.

## Technical Details

### Native Module (`ExpoVault`)

The `ExpoVault` native module is the backbone of the application's security.

#### iOS Implementation

-   **Key Management:** Utilizes `SecRandomCopyBytes` to generate a 32-byte symmetric key for AES-GCM. This key is stored in the iOS Keychain using `SecItemAdd` and protected with `SecAccessControl` flags requiring `biometryCurrentSet` for access.
-   **Biometric Authentication:** `LocalAuthentication.framework`'s `LAContext` is used to prompt for Face ID or Touch ID. The act of retrieving the key from the Keychain automatically triggers the biometric prompt due to the access control settings.
-   **Cryptography:** `CryptoKit`'s `AES.GCM` is employed for robust authenticated encryption and decryption of note content.
-   **File Management:** `FileManager` is used to store encrypted note data as individual files within the app's documents directory.

#### Android Implementation

-   **Key Management:** An AES key is generated using `KeyGenerator` and stored in the Android Keystore. `KeyGenParameterSpec` ensures the key requires user authentication for encryption and decryption operations.
-   **Biometric Authentication:** `androidx.biometric.BiometricPrompt` is used to authenticate the user. The Android Keystore automatically triggers the biometric prompt when the protected key is accessed.
-   **Cryptography:** `javax.crypto`'s `Cipher` class with `AES/GCM/NoPadding` is used for encryption and decryption. Initialization Vectors (IVs) for each encrypted note are stored separately in `SharedPreferences`.
-   **File Management:** Encrypted note data is stored as individual files in the app's internal storage (`Context.filesDir`).

### Expo Config Plugin

The custom JavaScript-based Expo config plugin (`expo-crypto-vault-plugin.js`) automates native project setup:

-   **iOS:** Injects `NSFaceIDUsageDescription` into `Info.plist` to comply with Apple's privacy requirements for Face ID usage.
-   **Android:** Adds the `android.permission.USE_BIOMETRIC` permission to `AndroidManifest.xml` and includes Proguard rules (`-keep class expo.modules.vault.** { *; }`) in `proguard-rules.pro` to prevent obfuscation of the native module's code during release builds.

## Testing

While comprehensive unit and integration tests are beyond the scope of this README, the following manual testing steps can be performed to verify core functionality:

1.  **Initial Launch:** Verify "VaultLocked Screen" with "Unlock Vault" and "Create a New Vault" buttons.
2.  **Create Vault:** Tap "Create a New Vault", confirm "Vault created" alert.
3.  **Unlock Vault:** Tap "Unlock Vault", authenticate with biometrics, verify navigation to "Your Notes" screen.
4.  **Create Note:** Tap "Create New Note", enter text, tap "Save Note", verify note appears in list.
5.  **Edit Note:** Tap existing note, modify content, tap "Save Note", verify update.
6.  **Delete Note:** Tap "Delete" next to a note, verify removal from list.
7.  **Export Vault:** Go to "Settings", tap "Export Vault", copy the displayed JSON string.
8.  **Import Vault:** Go to "Settings", tap "Import Vault", paste JSON, confirm "Import successful", verify imported notes.
9.  **Error Handling (Optional):** Test failed biometrics, creating vault when one exists, importing invalid JSON.
