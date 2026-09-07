# SecureVault

A secure document scanner and vault app built with React Native and Expo. Store sensitive documents with military-grade encryption, biometric authentication, and on-device OCR.

## Features

- **Biometric Authentication** - Secure access with Face ID, Touch ID, or device PIN
- **Native Encryption** - AES-256-GCM encryption using Android Keystore and iOS Keychain
- **Document Scanning** - Capture documents using camera or import from gallery/files
- **OCR Text Extraction** - Extract searchable text from images using ML Kit
- **Category Organization** - Organize documents by type: ID, Medical, Finance, Legal, Insurance, Receipts
- **Full-Text Search** - Search across document titles, tags, and extracted OCR text
- **Secure Sharing** - Temporarily decrypt and share documents when needed
- **Export/Import** - Backup and restore your encrypted vault
- **Offline-First** - All data stored locally with no cloud dependency

## Tech Stack

| Technology              | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| React Native            | Cross-platform mobile framework                     |
| Expo (Bare Workflow)    | Development tooling and native modules              |
| Expo Router             | File-based navigation                               |
| TypeScript              | Type safety                                         |
| Custom Native Module    | AES-GCM encryption with hardware-backed key storage |
| ML Kit Text Recognition | On-device OCR                                       |
| expo-image-picker       | Image/document selection                            |
| expo-camera             | Document scanning                                   |

## Architecture

```
src/
├── components/          # Reusable UI components
│   ├── DocumentCard.tsx     # Document thumbnail card
│   ├── CategoryChips.tsx    # Category filter chips
│   ├── EmptyState.tsx       # Empty list placeholder
│   ├── Skeleton.tsx         # Loading skeletons
│   ├── AnimatedComponents.tsx # Animation wrappers
│   └── ErrorBoundary.tsx    # Error handling
├── hooks/
│   └── useDocuments.ts      # Document state management with optimistic updates
├── services/
│   ├── DocumentService.ts   # CRUD operations for documents
│   └── OcrService.ts        # Text extraction wrapper
├── types/
│   └── index.ts             # TypeScript type definitions
└── utils/                   # Utility functions

app/                         # Expo Router screens
├── _layout.tsx              # Root layout with error boundary
├── index.tsx                # Lock screen (biometric auth)
├── settings.tsx             # Settings modal
└── documents/
    ├── _layout.tsx
    ├── index.tsx            # Document list with search
    ├── [id].tsx             # Document detail view
    └── add.tsx              # Add document flow

modules/expo-vault/          # Custom native module
├── android/                 # Kotlin implementation
│   └── ...                  # Android Keystore + AES-GCM
└── ios/                     # Swift implementation
    └── ...                  # iOS Keychain + AES-GCM
```

## Security Model

### Encryption

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Storage**:
  - Android: Keystore with hardware backing when available
  - iOS: Secure Enclave via Keychain
- **Key Generation**: Random 256-bit key generated on first launch
- **IV Handling**: Unique IV per encryption, stored alongside ciphertext

### Authentication

- Biometric prompt required on app launch
- Falls back to device PIN/password if biometrics unavailable
- Session persists while app is in foreground

### Data Storage

- Encrypted files stored in app's private directory
- Metadata stored as encrypted JSON
- Thumbnails encrypted separately for fast list loading
- No data leaves the device

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- Xcode 15+ (iOS development)
- Android Studio (Android development)
- Physical device recommended for biometrics/camera

### Installation

```bash
# Clone the repository
git clone https://github.com/naderalfakesh/secure-vault.git
cd secure-vault

# Install dependencies
yarn install

# Generate native projects
npx expo prebuild

# iOS: Install pods
cd ios && pod install && cd ..

# Run on iOS
yarn ios

# Run on Android
yarn android
```

### Development

```bash
# Start Metro bundler
yarn start

# Run with fresh cache
yarn start --reset-cache

# Type check
npx tsc --noEmit
```

## Native Module API

The `expo-vault` module provides secure storage operations:

```typescript
import { vault } from './modules/expo-vault';

// Initialize vault (generates encryption key if needed)
await vault.createVault();

// Authenticate with biometrics
const authenticated = await vault.unlockWithBiometrics();

// Store/retrieve strings
await vault.put('key', 'secret value');
const value = await vault.get('key');

// Store/retrieve files (encrypted)
await vault.putFile('document-id', '/path/to/file.pdf');
const decryptedPath = await vault.getFile('document-id', '/destination/path.pdf');

// Delete data
await vault.delete('key');
await vault.deleteFile('document-id');

// Export/Import vault
const backup = await vault.exportVault();
await vault.importVault(backup);
```

## Project Status

| Feature                  | Status   |
| ------------------------ | -------- |
| Biometric Authentication | Complete |
| Native Encryption Module | Complete |
| Document CRUD            | Complete |
| Camera Scanning          | Complete |
| Gallery/File Import      | Complete |
| OCR Integration          | Complete |
| Search & Filtering       | Complete |
| Skeleton Loaders         | Complete |
| Optimistic Updates       | Complete |
| Thumbnail Caching        | Complete |
| Error Boundaries         | Complete |
| Accessibility            | Complete |

## Technical Details

### Native Module Implementation

#### iOS

- **Key Management**: Uses `SecRandomCopyBytes` to generate a 32-byte symmetric key stored in the iOS Keychain with `SecAccessControl` requiring `biometryCurrentSet`
- **Biometric Authentication**: `LAContext` from `LocalAuthentication.framework` for Face ID/Touch ID
- **Cryptography**: `CryptoKit`'s `AES.GCM` for authenticated encryption
- **File Storage**: `FileManager` for encrypted file operations

#### Android

- **Key Management**: `KeyGenerator` with Android Keystore and `KeyGenParameterSpec` requiring user authentication
- **Biometric Authentication**: `androidx.biometric.BiometricPrompt` with `DEVICE_CREDENTIAL` fallback
- **Cryptography**: `javax.crypto.Cipher` with `AES/GCM/NoPadding`
- **File Storage**: App's internal storage (`Context.filesDir`)

### Expo Config Plugin

Custom plugin (`plugins/withSecureVault.js`) automates native setup:

- **iOS**: Injects `NSFaceIDUsageDescription` into `Info.plist`
- **Android**: Adds `USE_BIOMETRIC` permission and Proguard rules

## License

MIT

## Author

Nader Alfakesh
