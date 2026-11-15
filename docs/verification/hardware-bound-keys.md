# Hardware-bound device key, and the minor dependency updates

> Verified: 2026-11-15 (host: `npm run validate`, `swift test`, the Kotlin
> suite; iOS Release build on the iOS 27.2 simulator; Android Release build
> compiled and installed on the Pixel 9, not exercised there)
>
> Base: `main` at `b5580e8`. Decision: [ADR 0009](../adr/0009-hardware-bound-device-key.md).

## What changed

- Dependencies, within their ranges: `react-native-unistyles` 3.5.3 to
  3.8.1 (native), `prettier` 3.10.1, `better-sqlite3` 13.2.0, `@babel/core`
  7.29.13, `expo-doctor` 1.21.8. Packages pinned by the Expo SDK stay where
  Expo puts them. The 21 `npm audit` findings are inside Jest and the Expo
  CLI; npm's only fix is downgrading those tools to older major versions, so
  they stay.
- iOS: `ios/SealedKey.swift` adds SVK1, the vault key sealed to a Secure
  Enclave P-256 key (ECIES: ephemeral P-256, HKDF-SHA256, AES-256-GCM).
  `createVault` seals new keys; the first unlock of an existing vault seals
  the plain Keychain item and removes it once the sealed copy opens. Without
  an enclave (the simulator) the plain item stays. The session keeps the key
  its context opened until the vault locks.
- Android: `KeyProtection.kt` reads the Keystore key's `KeyInfo` and reports
  `trusted-environment`, `strongbox` or `software`. The key itself is
  unchanged.
- `keyProtection()` on both platforms. "How your data is protected" names
  the Secure Enclave or secure hardware only when the device reports it.

## Checks

| Check                              | Result                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run validate`                 | Green: 92 suites, 907 tests, Expo Doctor 20/20                                                            |
| `npm run test:native:ios`          | 21 tests. The 7 new SVK1 tests include a round trip through this Mac's own Secure Enclave (Apple Silicon) |
| Kotlin suite (`testDebugUnitTest`) | 22 tests, 2 new for the security-level names                                                              |
| iOS Release build (simulator)      | `BUILD SUCCEEDED` after `pod install`                                                                     |
| Android `assembleRelease` (arm64)  | `BUILD SUCCESSFUL`                                                                                        |

The SVK1 tests cover the round trip, a fresh ephemeral key per seal,
another recipient refused, every byte after the header altered, bad magic,
short and long items, and wrong key sizes. GitHub's macOS runners have no
Secure Enclave, so CI skips only the enclave round trip.

## Device runs

| Run                                   | Result                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS 27.2 simulator, existing vault    | Release build installed over the vault from 2026-11-14. Face ID unlock opened it with one prompt; the four sample documents and their thumbnails showed. Unistyles 3.8.1 renders as before |
| iOS 27.2 simulator, protection screen | "kept by the iOS Keychain": the simulator has no enclave, so the plain item stays and the screen claims nothing more                                                                       |
| Pixel 9 (Android 17)                  | The Release build installed over the existing app (`adb install -r`). The owner skipped the unlock, so the vault, Unistyles 3.8.1 and the key level were not checked on the phone          |

## Owed

- A physical iPhone: create a vault (sealed from the start), and update over
  an existing vault (the move from the plain item). Both should show one
  Face ID prompt per unlock and "sealed by its Secure Enclave" on the
  protection screen.
- The Pixel 9: unlock the updated build, and check that the protection
  screen names this phone's secure hardware (`trusted-environment`).
