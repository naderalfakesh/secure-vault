# Native tests for the vault module

> Verified: 2026-11-14 (host: `swift test`, the Kotlin suite through
> `./gradlew :expo-vault:testDebugUnitTest`, `npm run validate`, the
> ExpoVault pod built for the iOS simulator)
>
> Base: `main` at `d2a4ea6`.

## What is tested

The vault's three file formats, on both platforms, against one set of vectors:

| Format | What it holds                                         | Swift | Kotlin |
| ------ | ----------------------------------------------------- | ----- | ------ |
| SVC1   | Every vault file and every backup payload, in chunks  | yes   | yes    |
| SVS1   | Android string entries (the index key, the key probe) | n/a   | yes    |
| SVB1   | The passphrase backup that moves a vault between OSes | yes   | yes    |

`modules/expo-vault/tests/make-fixtures.mjs` writes the vectors with Node's
crypto, following the layout described in `VaultCrypto` and
`BackupContainer`. It is a third implementation, so each app is checked
against bytes neither of them wrote. Nonces and the salt come from fixed
labels, so the output is the same on every run; CI regenerates it and fails
on any difference.

| Vectors        | Cases                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streams        | Four chunks, empty, one chunk, and a stream cut on a chunk boundary, which reads as a shorter file (the documented limit of a format with no end marker)                                                                                                                                                                                                                     |
| Broken streams | Altered tag, altered ciphertext, two chunks swapped, cut inside a chunk, a chunk length past the end, a length shorter than nonce and tag. Each must fail and leave no plaintext file                                                                                                                                                                                        |
| Pre-2026 files | The 2025 prototype's single sealed box (iOS) and its ciphertext with the nonce kept elsewhere (Android), and an Android string entry from before SVS1                                                                                                                                                                                                                        |
| Backups        | A valid backup; a wrong passphrase; a check entry with another value; damage only in the last payload; 2,000,000,000 iterations, a newer version and another cipher (unsupported); a string iteration count, an empty salt, trailing data, a cut payload, a duplicate key, no check entry first, an unknown kind, too few entries, and a file that is not a backup (corrupt) |

Both suites also check what the vectors cannot:

- Round trips at 0, 1, and around the 1 MiB chunk boundary, with the exact
  container size.
- The same plaintext seals differently every time.
- Every failing backup is refused before `handle` sees an entry, and staging
  is empty afterwards. A cancel before the restore pass, or a preflight
  refusal, also stops before `handle`.
- The unsupported iteration count is refused in well under a second, so no
  key is derived from it.
- `restoreNeeds` arithmetic on the vector's layout.
- Only the app's own staging folder is accepted: not a relative path, not
  the cache root, not another folder, not a symlink at the right name.
- Android string entries: write and read back, no `.tmp-` file left behind,
  an altered entry fails its tag, a cut entry is corrupt, and an older entry
  without its stored nonce is an error.

## How they run

- **Swift:** `modules/expo-vault/Package.swift` builds `VaultCrypto.swift` and
  `BackupContainer.swift` as a plain Swift package, so `swift test` runs on
  the Mac with no simulator (about 11 s, build included). To make that
  possible, the UIKit thumbnail helper moved to `VaultCrypto+Thumbnail.swift`,
  and `availableMemory()` returns nil off iOS, where
  `os_proc_available_memory` does not exist. `VaultCrypto.readBe32` now uses
  `loadUnaligned`, as `BackupContainer` already did.
- **Kotlin:** JUnit 4 with Robolectric 4.17 under `android/src/test`, run by
  `./gradlew :expo-vault:testDebugUnitTest` in the prebuilt app project
  (about 20 s once Gradle is warm). Robolectric gives the backup container
  real `android.util.Base64`, `org.json` and `android.system.Os`. Its Android
  runtime (about 190 MB) is downloaded into the Gradle user home, not `~/.m2`.
- **CI:** `.github/workflows/native-tests.yml` runs the Swift job on macOS and
  the Kotlin job on Ubuntu after `expo prebuild --platform android`.

## Checks

| Check                                          | Result                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `swift test --package-path modules/expo-vault` | 14 tests, 0 failures                                                                                         |
| `./gradlew :expo-vault:testDebugUnitTest`      | 20 tests, 0 failures                                                                                         |
| Fixtures regenerated twice                     | Identical bytes                                                                                              |
| Mutation check, Swift and Kotlin               | Removing the trailing-data and entry-kind checks fails the vector test on both platforms, naming the vectors |
| `xcodebuild -scheme ExpoVault` (simulator)     | `BUILD SUCCEEDED` after `pod install`                                                                        |
| `npm run validate`                             | Green                                                                                                        |

## Found on the way

- Robolectric 4.17 does not decode the `%20` in its own jar path, so its
  native runtime does not load from a folder with a space in its name, such
  as this project's SSD. CI paths have no spaces. Locally, `ROBOLECTRIC_HOME`
  can point at a space-free symlink to the same folder.
- Robolectric's `Os.lstat` reports a missing path as a symbolic link instead
  of raising `ENOENT`. The tests create the staging folder before resolving
  it, so the "missing folder is fine" branch of `StagingDirectory.resolve` is
  covered only by device runs.

## Not covered

- Keychain and Keystore code (`VaultKeychain`, the key session, the
  biometric prompt): they need a device or simulator and stay with the
  device runs in `review-fixes.md`.
- PDF rasterising and thumbnails, which need UIKit or Android graphics.
