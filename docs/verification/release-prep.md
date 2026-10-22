# Release prep: whole-project review fixes

Branch `fix/release-prep`, from `qa/final-fixes` 6f71574. Scope is the
findings of the whole-project review before the device handoff (F1 and F3 to
F10). F2, an iOS Keychain re-prompt that only a device can show, is left for
the device run.

Nothing changes in the backup format, the crypto or the keys' parameters.
The native changes are new vault module functions: three iOS ones for the
reinstall check (F9) and `clipboardStamp` on both platforms (F1, review
round). No simulator, emulator or device was used and nothing
native was built (see "Not verified").

## Fixes

| Item | Change                                                                                                                                                                                                                                                                                                                       | Commit                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| F1   | "Copy text" uses expo-clipboard 58's options: iOS `localOnly` with a 2-minute `expiresAt`, Android `isSensitive`. A lock empties the clipboard when it still holds that text; anything copied since is left alone. After review, judged by the clipboard's change stamp (`e266b45`) instead of reading the text.             | `7a0ab87`                                             |
| F7   | Change PIN judges the current PIN against the lock screen's lockout, one attempt at a time; a wrong one counts, and a running pause returns `locked-out` without checking. The device unlock still opens the vault and resets the count.                                                                                     | `9fc537c`                                             |
| F8   | The lock sweep moved into `useVaultSweep`, which also sweeps the caches once at a launch that lands on `setup` or `unavailable`.                                                                                                                                                                                             | `ed64f52`                                             |
| F9   | iOS: a UserDefaults flag (`com.naderalfakesh.securevault.installed`). Without it, Keychain items with no vault entries, index file or PIN markers on disk are a reinstall: the device key and the five secure-store entries are deleted and launch goes to onboarding. Files on disk mean an update, and everything is kept. | `02a5b7f`                                             |
| F10  | `PRAGMA cipher_version` at open, failing closed with `SQLCIPHER_UNAVAILABLE`; no-follow removal for share copies and finished backups; `*.svbackup` and `coverage/` ignored; sync PIN hashing and `createBackup` moved to `src/testing/`; `useSQLCipher` and `enableFTS` listed in CLAUDE.md.                                | `44b8d13`, `6a69b2d`, `e659f70`, `2fdd9e5`, `a88e959` |
| F3   | README: solid privacy cover, Phase 2 ran on iOS only, no physical device or release build yet, no JSI plugin. Screenshots not replaced (see below).                                                                                                                                                                          | `f8d7f7d`                                             |
| F4   | ADR 0001: the effect on device builds is unverified; the patch rewrites arm64 device objects and no device build or archive was made.                                                                                                                                                                                        | `d39a9e7`                                             |
| F5   | "Google says ML Kit doesn't send…" in the protection page, the processing sheet, README and SECURITY.md.                                                                                                                                                                                                                     | `41a8ad4`                                             |
| F6   | SECURITY.md: solid cover, iOS device backups hold the vault's ciphertext (new-phone restore untested), the viewer keeps decrypted pages until the lock, import cleanup native QA passed. Comments on the PIN record and the Keystore window; ADR 0003 brought up to date.                                                    | `b785785`, `6e7820c`, `e761dea`                       |
| —    | Local paths, evidence ticket ids and a local worktree name removed from the verification notes.                                                                                                                                                                                                                              | `07f2085`                                             |

`closeDocumentStore` stays: `deleteDocumentStore` ("Delete everything") uses
it, so it is not test-only. The handover §-citing comments are unchanged.

## Tests

Each fix has a test that failed before it:

- `src/features/viewer/__tests__/clipboard.test.ts`: the options, the clear
  on lock, text copied since left alone, no read after the iOS expiry, an
  unreadable clipboard.
- `src/__tests__/change-pin.test.tsx`: five wrong current PINs pause the
  keypad on both screens, the right PIN is refused during the pause, the
  device unlock ends it, and the right PIN resets the count.
- `src/features/session/__tests__/useVaultSweep.test.tsx`: the launch sweep on
  `setup` and `unavailable`, once, and every lock.
- `src/features/session/__tests__/freshInstall.test.tsx`: reinstall cleared,
  update kept (entries, index file, or markers alone), first install, flag
  already set, unreadable Keychain or folder decides nothing, a failed delete
  leaves the flag unset, Android untouched, and through `SessionProvider` a
  reinstall reaches setup while an update reaches the lock screen.
- `src/data/__tests__/expoSqlite.test.ts`: the cipher check runs right after
  `PRAGMA key`, and plain SQLite closes the connection with the typed error.
- `DocumentService.test.ts` and `BackupService.test.ts`: share copies and
  finished backups go through `removeTreeNoFollow`.

`npm run validate` exits 0: prettier, eslint, tsc, 799 Jest tests in 85
suites, expo-doctor 20/20.

## Screenshots (F3)

Not replaced. Every candidate in the screenshots of the final native QA at
48673b1 and the milestone 1 QA at 27419d3 was taken from a development build and
shows the dev client's Tools bubble, and several library shots show QA
titles ("QA delete C"). The documents themselves are synthetic. The README
keeps its earlier screenshots until a clean set is captured.

## Not verified

- No native compile. The native re-QA in another worktree had its Android
  emulator running, so neither the Swift change for F9 nor the rest was
  built. The Kotlin edit is a comment.
- The clipboard options, the lock clear and the reinstall check need a
  device or simulator (list below).

## Native checks for the device handoff

1. iOS build compiles the new `hasInstallMarker`, `setInstallMarker`,
   `deleteDeviceKey` and `clipboardStamp` functions; Android compiles
   `clipboardStamp`.
2. iOS reinstall: set up a vault, delete the app, reinstall: onboarding, no
   old lock screen, and a new setup works.
3. iOS update: install the previous build with documents, install this
   build over it: lock screen, the old PIN unlocks, every document opens.
4. iOS, launch before the first unlock after a reboot: no data is cleared and
   the next launch decides.
5. Copy text on iOS: not offered on a Mac through Universal Clipboard, gone
   after 2 minutes, gone after a lock, and no "Allow Paste" prompt at the
   lock when another app copied something meanwhile (that copy is kept).
6. Copy text on Android 13+: no clipboard preview, gone after a lock, no
   "pasted from your clipboard" toast, and kept when something else was
   copied after it.
7. Change PIN: five wrong current PINs pause it and the lock screen; the
   device unlock still opens the vault.
8. A launch that lands on setup or "unavailable" leaves no decrypted files
   in the cache.
9. SQLCipher present in both release builds (the index opens, no
   `SQLCIPHER_UNAVAILABLE`).
10. F2: the iOS Keychain re-prompt on a device.
11. A device build and an App Store archive with the ML Kit patch, plus a
    signed Android release APK.
12. A clean screenshot set (no Tools bubble, no QA titles) for the README.

## Review round

The review approved with one Medium and three smaller items, fixed with a
failing test first:

- Medium F1 (`e266b45`): the lock no longer reads the clipboard, which
  showed iOS's "Allow Paste" prompt or Android 12's toast when another app
  had copied since. `clipboardStamp` (iOS `changeCount`, Android 8+ primary
  clip timestamp) is noted after the copy, and the lock clears only while it
  is unchanged; an unknown stamp leaves the clipboard alone.
- Low (`df97168`): the reinstall check deletes the secure-store entries
  first and the device key last, so a run cut short never leaves a PIN
  without its key and the next launch finishes. Comments note that `.exists`
  reads false on a stat error and the entry listing is the deciding check.
- Info (`1ebe28c`): a Change PIN call while another attempt runs answers
  `busy`, and the screen goes back to the confirmation step instead of
  resetting.

## R8 and ML Kit registrars (device finding)

On the Pixel 9 the release APK (R8 on) rejected "Scan with the camera" with
a `NullPointerException` and text reading on imports returned nothing. A
dexdump of that APK showed `CommonComponentRegistrar`,
`VisionCommonRegistrar` and `TextRegistrar` kept without their no-argument
constructor and `ComponentRegistrar` renamed. Firebase's component discovery
creates the registrars by reflection from the manifest names, so
`MlKitContext` got no components.

`plugins/withSecureVault.js` now appends:

```
-keep class * implements com.google.firebase.components.ComponentRegistrar { void <init>(); }
-keep,allowshrinking interface com.google.firebase.components.ComponentRegistrar
```

Evidence from `assembleRelease -Pandroid.enableMinifyInReleaseBuilds=true`
(JDK 17), `mapping/release/` and dexdump:

- `seeds.txt` lists the three registrars with their constructors and the
  interface; `mapping.txt` maps each to itself.
- dexdump: every class implementing
  `com.google.firebase.components.ComponentRegistrar` (the three above, the
  same three the manifest names) has `<init>()`. The document scanner AAR
  has no registrar of its own; it goes through the ML Kit common and vision
  common ones.
- Already safe without new rules: `ScanOptions` keeps `quality`, `maxPages`
  and their `@Field` annotations (expo-modules-core's Record rules); the
  scanner module is renamed, which is fine because the generated package
  list references it by class; `TextRecognitionModule`, the expo-sqlite JNI
  bindings, the scanner's delegate activity and the vault module keep their
  names; the ML Kit AARs ship their own consumer rules.

`npm run validate` exits 0 (838 tests, expo-doctor 20/20). Not verified:
the scan and text reading on the phone itself.
