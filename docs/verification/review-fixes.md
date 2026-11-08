# Review fixes: CI, native key handling, repository hygiene

> Verified: 2026-11-05 (host: `npm run validate`, the vault module compiled
> natively on both platforms; release builds run on the Pixel 9, the iOS 27
> simulator and an Android 10 emulator, see "App runs")
>
> Base: `main` at `4d656ee`.

## CI

The last two runs on `main` failed at Expo Doctor only: 18 packages were a
patch behind SDK 58 (`expo` 58.0.23, `expo-router` 58.0.30, `react-native`
0.88.1, and others). All 890 tests passed in those runs.

- `npx expo install --fix` moved every package to the expected patch.
- `npm run check` runs Prettier, ESLint, TypeScript and Jest. `npm run validate`
  is `check` plus Expo Doctor, as before.
- `ci.yml` (the README badge) runs `npm run check`. Expo Doctor moved to
  `doctor.yml`, which also runs on Mondays, so an Expo patch release shows up
  as drift without failing the build.

## iOS: one prompt per unlock

The device key's Keychain item has a `.userPresence` access control, and
`VaultKeychain.loadKey` read it without an `LAContext`. Each read could
therefore show its own Face ID or passcode prompt: once inside
`unlockWithBiometrics` right after its own prompt, and again for later reads.
`docs/verification/device-handoff.md` item 1.8 has not been run on a
physical iPhone yet.

Fix (`VaultKeychain.swift`, `ExpoVaultModule.swift`):

- `VaultKeySession` holds the session's `LAContext` under a lock. Every key
  read passes it as `kSecUseAuthenticationContext`.
- `unlockWithBiometrics` adopts the context it has just evaluated, so its own
  key read is silent. A PIN unlock's first read prompts through a fresh
  context, which the session then keeps.
- A failed read, a new key (`createVault`) and `deleteDeviceKey` discard the
  context.
- `endKeySession()` (synchronous, a no-op on Android) invalidates it. The
  session provider calls it on every status change other than `unlocked`, so
  a lock, auto-lock, erase or setup all end it.
- Test: `SessionProvider.test.tsx` "ends the key session when the vault
  locks, by hand or by auto-lock".

## Android 9 and 10: the unlock prompt

`BIOMETRIC_STRONG | DEVICE_CREDENTIAL` is not supported before Android 11:
androidx throws when the prompt is built, so `unlockWithBiometrics` always
rejected with `BIOMETRIC_ERROR`, and `createVault`'s check saw
`BIOMETRIC_ERROR_UNSUPPORTED` and went on. `promptAuthenticators()` now uses
`BIOMETRIC_WEAK | DEVICE_CREDENTIAL` below API 30, the only combination with
the screen lock that those versions accept, for both the check and the prompt.
A weak biometric cannot open the Keystore key. When the user unlocks with one,
the key read that follows fails as `KEY_LOCKED`, and the existing recovery
prompts once more, with the screen lock still offered.

## Android: crash-safe string entries

`put` wrote the nonce to SharedPreferences with `apply()`, then the
ciphertext with a plain `writeBytes`. A kill between the two left a nonce and
ciphertext that did not match. For `_database_key` that means an index that
never opens again. Restore wrote string entries the same way.

Fix (`StringEntry.kt`, `ExpoVaultModule.kt`): string entries are now `SVS1`.
The file holds the magic, the 12-byte nonce, then ciphertext and tag. It is
written to `.tmp-<name>` (outside the entry grammar), synced, and renamed over
the entry. `put` and restore write `SVS1`. `get` and the backup export read
`SVS1` or, for older entries, the nonce from preferences. The first write of
an older entry moves it to `SVS1` and removes its preference with `commit()`.
The backup kind is unchanged (`s`), because detection still keys on `SVC1`,
so backups stay readable on both platforms.

iOS `put` now writes with `.atomic`, like its restore path already did.

## Repository hygiene

- Removed `ExpoVaultView.swift` and `ExpoVaultView.kt`. They were Expo's
  WebView template, never registered by the module, and linked WebKit into it.
- `expo-module.config.json` no longer lists `web`, and the podspec no longer
  targets tvOS. Neither can run the module. Both podspecs point at the repo.
- About 100 code comments cited sections of a design handover that is not in
  the repository (`handover §6 J5`, `§3.5`, `F7`). The citations are gone.
  Where a sentence leaned on one, it now says what it means.

## Checks

| Check                                      | Result                                              |
| ------------------------------------------ | --------------------------------------------------- |
| `npm run validate`                         | Green: 91 suites, 891 tests, Expo Doctor 20/20      |
| `./gradlew :expo-vault:compileDebugKotlin` | `BUILD SUCCESSFUL` (JDK 17, after `expo prebuild`)  |
| `xcodebuild -scheme ExpoVault` (simulator) | `BUILD SUCCEEDED` (Xcode 27, after `expo prebuild`) |

## App runs

Release builds of `9e1e294`: an arm64 APK (`assembleRelease`, JDK 17) and a
simulator `.app` (`xcodebuild -configuration Release`). The iOS app now builds
straight from the SSD path; the expo-constants and Bundle React Native phases
quote it in SDK 58.

| Check                                                                                                                                                                      | Result                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel 9 (Android 17), APK installed over the 2026-10-23 build (same certificate, first install date kept), vault with `_database_key` and `_key_probe` in the older format | Fingerprint unlock opened the library with all 5 documents                                                                                                       |
| Pixel 9, backup created after the update                                                                                                                                   | `SecureVault backup 2026-11-05.svbackup`, 1.37 MB, `SVB1`                                                                                                        |
| iOS 27.2 simulator, restore of that backup                                                                                                                                 | 15 entries checked, 5 documents with thumbnails, same titles and collections as on the Pixel                                                                     |
| iOS, Face ID unlock (LocalAuthentication log)                                                                                                                              | 1 prompt, 1 `evaluatePolicy`, the 5 key reads that follow reuse that `LAContext`                                                                                 |
| iOS, restore and thumbnails while unlocked                                                                                                                                 | 0 prompts, 16 key reads, all on the session context                                                                                                              |
| iOS, Lock now, then Face ID                                                                                                                                                | Context invalidated; 1 prompt, a new context for the reads after it                                                                                              |
| Android 10 (API 29) emulator, new AVD `SecureVault_API29`, screen-lock PIN, no biometric enrolled                                                                          | Vault setup showed the system prompt ("Unlock your vault") and finished. After the 300 s key window, PIN unlock hit `KEY_LOCKED`, prompted once more, and opened |

## Owed

- iOS: the same prompt count on a physical iPhone (handoff item 1.8). The
  simulator shows the behaviour, but Face ID there is simulated.
- Android 9 and 10 with a fingerprint enrolled: a weak-biometric unlock should
  fall back to the screen lock prompt for the key read. Only the screen lock
  path was run.
