# Expo SDK 58 verification

> Verified: 2026-10-21 (builds only; native runtime QA pending)
>
> Scope: upgrade from Expo SDK 57.0.29 to SDK 58 stable on branch
> `chore/expo-sdk58` (base 4658728), dependency alignment, the code and test
> changes the new APIs need, removal of the SDK 57 workarounds that SDK 58
> ships upstream, and Debug builds on both platforms from the spaced SSD path.

## Target

On 2026-10-20 the npm `expo` dist-tag `latest` is 58.0.16. The upgrade used
`npm install expo@^58.0.16`, `npx expo install --fix` and
`npx expo install --check` ("Dependencies are up to date"), with Node 24.13.0.
The range is written as `~58.0.16` to match the other Expo packages.

| Package                      | SDK 57      | SDK 58        |
| ---------------------------- | ----------- | ------------- |
| expo                         | 57.0.29     | 58.0.16       |
| react-native                 | 0.86.3      | 0.88.0        |
| react / react-dom            | 19.2.3      | 19.3.0        |
| expo-sqlite                  | 57.0.4      | 58.0.13       |
| expo-secure-store            | 57.0.4      | 58.0.2        |
| expo-file-system             | 57.0.6      | 58.0.10       |
| expo-router                  | 57.0.27     | 58.0.24       |
| expo-build-properties        | 57.0.22     | 58.0.11       |
| expo-modules-jsi             | 57.1.x      | 58.0.16       |
| react-native-gesture-handler | 2.32.x      | 3.3.0         |
| react-native-reanimated      | 4.5.1       | 4.7.1         |
| react-native-worklets        | 0.10.1      | 0.13.0        |
| jest / jest-expo             | 29.7 / 57.0 | 30.5.2 / 58.0 |

The old lockfile could not be updated in place (npm ERESOLVE on the optional
`@expo/ui` and `expo-symbols` peers of expo-router 58 against the installed 57
tree), so `node_modules` and `package-lock.json` were regenerated from
scratch. The new lockfile has the `@emnapi` entries, and `npm ci` succeeds
from it.

Toolchain: Xcode 27.1 (27A9275), openjdk 17.0.19, Gradle 9.4.1, AGP 9.2.1,
Kotlin 2.2.0. The generated Podfile targets iOS 16.4.

## Changes

- `File.write()` is asynchronous in expo-file-system 58.
  `DocumentService.getLocalFilePath` now awaits it, so a picked `content://`
  file is fully written before its path goes to the vault module. Test
  fixtures that used an unawaited `write()` use `writeSync()`. No code uses
  `FileHandle.readBytes` or `writeBytes`, which also became async.
- Jest: reanimated 4.7 runs native initializers that the worklets-only
  resolver no longer covers. `jest.config.js` uses
  `react-native-reanimated/jest/resolver.js` (it wraps the worklets resolver),
  `jest.setup.js` mocks `react-native-worklets` with the package's own mock,
  and `react-native-gesture-handler/jestSetup.js` is a setup file because
  gesture handler 3 installs UI runtime bindings at import.
- Strict TypeScript API (the default since RN 0.87): `useRef<ScrollView>` and
  `useRef<TextInput>` became `ScrollViewInstance` and `TextInputInstance` in
  the onboarding screen, the category chips and the documents search field.
- `ios.enableSceneSupport` removed from `app.json`. expo-build-properties 58
  documents it as a no-op from SDK 58 on ("no longer required and can be
  removed"). After prebuild, `ios/SecureVault/SceneDelegate.swift` exists and
  the built `Info.plist` declares `UISceneDelegateClassName`
  `SecureVault.SceneDelegate`.
- `plugins/withJsiSwift64Fix.js` and `plugins/jsi-interface-patch.py`
  removed. Line 344 of expo-modules-jsi 58.0.16
  `apple/scripts/build-xcframework.sh` is byte-identical to the patch's
  replacement line, and the iOS build compiles every ExpoModulesJSI importer
  on Xcode 27.1 without it.
- `finalizeUnusedStatementsBeforeClosing: false` removed from the index open.
  In expo-sqlite 58 (expo/expo#50121) `maybeFinalizeAllStatements` on iOS
  (`SQLiteModule.swift`) and Android (`SQLiteModule.kt`) finalizes only the
  statement wrappers expo-sqlite itself prepared ("Do not destroy
  SQLite-internal statements owned by concurrent exec/backup operations"), so
  FTS5's own statements are no longer freed twice. The adapter's
  drain-before-close and memoized close are unchanged.
- `plugins/withSqlCipherOpenSsl.js`: AGP 9 rejects a task provider in
  `sourceSets.main.jniLibs.srcDir` ("You cannot add Provider instances to the
  Android SourceSet API"). The plugin now adds the extract directory as a
  plain directory (the existing `preBuild` dependency still runs the extract
  first) and uses `android.packaging` instead of the deprecated
  `packagingOptions`.

Kept: `usePrecompiledModules: false`, `withSqlCipherOpenSsl`,
`withMlkitSimulatorFix`, `withSecureVault`, and openjdk 17 for Gradle.

## Checks

| Check                                    | Result                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run validate`                       | Pass: prettier, eslint, tsc, jest 24 suites and 233 tests, expo-doctor 20/20 |
| `npm ci` from the new lockfile           | Pass                                                                         |
| `npx expo prebuild --clean`              | Pass; the Podfile keeps the ML Kit fix, app `build.gradle` the OpenSSL block |
| iOS Debug simulator build, ad-hoc signed | `** BUILD SUCCEEDED **` from the spaced SSD path                             |
| Android `assembleDebug`                  | `BUILD SUCCESSFUL` (921 tasks) from the spaced SSD path                      |
| Android `assembleRelease` (R8)           | Not run                                                                      |

iOS: `xcodebuild -workspace SecureVault.xcworkspace -scheme SecureVault
-configuration Debug -sdk iphonesimulator -destination "generic/platform=iOS
Simulator" CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO`, DerivedData on the
SSD. The app is signed `adhoc`, `Frameworks/` holds React, hermesvm,
ReactNativeDependencies and ExpoModulesJSI, and `EXConstants.bundle/app.config`
is present. The ExpoVault Swift module compiles; its only warning is the
existing `kSecUseAuthenticationUIFail` deprecation.

The spaced-path quoting patch is no longer needed. The SDK 58 template quotes
the Bundle React Native phase's command substitution, and the EXConstants
phase quotes its script path and `basename "$PROJECT_DIR"`. The build ran on
unmodified generated projects.

Android: `./gradlew assembleDebug --max-workers=4` in `zsh -lic` with
`JAVA_HOME` set to Homebrew openjdk@17. The template sets
`android.newDsl=false` and `android.builtInKotlin=false`, so the local
modules' `lintOptions` blocks and `expo-vault`'s `compileSdkVersion` fallback
(34, overridden by the root project's value) still evaluate. `expo-vault`,
`expo-document-scanner` and `@react-native-ml-kit/text-recognition` (with its
old-style `build.gradle`) compile without errors. The APK carries
`libcrypto.so` next to `libexpo-sqlite.so` for arm64-v8a, armeabi-v7a, x86
and x86_64. If the template later turns on `android.newDsl`, those blocks need
the `lint {}` and `compileSdk` spellings.

## Behaviour changes to watch in QA

- expo-secure-store 58 on iOS rejects `deleteItemAsync` when the Keychain
  refuses a delete, where 57 resolved. `sessionStorage.clear()` passes the
  rejection on, but the erase still ignores it, so a refused PIN record
  delete stays silent and the app moves to setup as before. Setup then
  overwrites the PIN, settings, and lockout.
- expo-sqlite 58 on Android moved to Expo Modules API 2.0, and reloading the
  app now closes databases that are still open. The index swap and reload
  paths (M1, L1) need a rerun.
- SQLCipher goes from 4.7.0 to 4.17.0. The vendored source keeps
  `PBKDF2_ITER 256000` and the SHA512 HMAC; the index uses a raw hex key, so
  an SDK 57 index should open unchanged. That still needs proving on a
  simulator or device.

## Not verified

- Native runtime QA on simulator, emulator or devices. Nothing was booted for
  this note.
- `assembleRelease` with R8.
- Physical devices.

## Polish

Branch `fix/polish-pass` on 853d005, 2026-10-21. JavaScript, tests, docs and
one config plugin; no Swift or Kotlin changed. Each fix has a test that failed
before it. `npm run validate` passes: prettier, eslint, tsc, jest 29 suites
and 267 tests, expo-doctor 20/20. Nothing was built or booted.

| Item                                                                                                                                                           | Commit  | Test                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| M. `content://` import copy (`temp_import_<n>`) removed after every save or preview, also on failure; the sweep matches that exact name instead of any `temp_` | e2b5451 | `importResidue.test.ts` "Android content:// import copies"              |
| 7. An export unlinks a planted `backup` folder before writing into it; a folder that cannot be cleared stops it with `BACKUP_STAGING_INVALID`                  | 554ef2a | `BackupService.test.ts` "folders planted as symbolic links"             |
| 8. A restore whose extras folder cannot be cleared fails with `BACKUP_RESTORE_STAGING_INVALID` and its sentence, not ERR_UNEXPECTED                            | a32cfae | same                                                                    |
| 11. An erase that did not finish still clears the decrypted cache                                                                                              | 8a558cd | `DocumentService.test.ts`                                               |
| 6. A refused PIN record delete during an erase is retried once; if it stays, the erase is reported with a sentence asking for setup                            | a5aaaaf | `SessionProvider.test.tsx`, `settings-backup.test.tsx`                  |
| 1. A cancelled or lapsed key prompt shows a plain sentence on the lock screen, the document screen, the lists and the add screen                               | 8c16685 | `errors.test.ts`, `document-share.test.tsx`, `SessionProvider.test.tsx` |
| 4. Setup with an invalidated key on a non-empty vault explains it in plain words                                                                               | dac7e40 | `SessionProvider.test.tsx`                                              |
| 2. Home shows the Documents tab's error state while the index is closed                                                                                        | c4f32e0 | `home-screen.test.tsx`                                                  |
| 3. Setup after "Delete everything" (in session or after a relaunch) no longer says the documents stay                                                          | 37fc6c5 | `setup-pin.test.tsx`                                                    |
| 5. A save that settles after the lock but before the screen goes reports after the next unlock                                                                 | fa404f6 | `add-document.test.tsx` "a save the lock interrupts"                    |
| 9. `withSqlCipherOpenSsl` writes a begin/end-marked block and replaces an older or unmarked one                                                                | db838b6 | `plugins/__tests__/withSqlCipherOpenSsl.test.js`                        |
| 10. The iOS Inbox copy the system renamed for a duplicate ("scan 2.pdf") is removed too                                                                        | 4b52a6c | `importResidue.test.ts`                                                 |

Item 5: the save already went to `postNotice` once the screen had unmounted.
The gap was the moment between the lock (the session ends at once) and the
gate unmounting the screen: a save that settled then showed a toast, and the
lock cleared it. The add screen now checks whether its session ended.

Item 9: the new marker was checked against the AGP 8 `build.gradle` of an
older worktree (`sv-qa-batch5`): one block after the rewrite, no
`packagingOptions`, the rest of the file unchanged, and a second run changes
nothing. Not run through `expo prebuild`.

Not changed:

- 12. `installDatabaseFile` still moves the restored index back when
      recording its name fails. Left in place, it would not fail closed when the
      vault's `_database_file` names an index that still exists (a backup of the
      same vault): the open would take the named, pre-restore file and then sweep
      the unnamed restored one as a leftover. The current path ends as
      `BACKUP_INDEX` and the user restores again, which is safer.
- The in-memory post-erase hold and the test-only `createBackup`, as asked.

Native checks for the next milestone QA:

- Android: import a file that arrives as a `content://` URI (a PDF from a
  cloud provider), save it and cancel one; no `temp_import_*` left in the cache.
- Android: cancel the key prompt on reopen and on a document; the plain
  sentence shows, and opening the document again prompts again.
- Android: setup with an invalidated key on a vault that still has entries.
- Both: Home with a fail-closed index; setup copy after "Delete everything"
  and after a relaunch before setup.
- Android: export with `cache/backup` planted as a link (nothing written
  through it), and a restore with a link that resolves outside the cache.
- Android: `npx expo prebuild` without `--clean` over an AGP 8 generated
  project, then `assembleDebug`, and check `libcrypto.so` in the APK.
- iOS: import the same file twice from Files so the Inbox copy is renamed;
  the Inbox is empty afterwards.
- Both: lock during a slow save; the outcome shows after the next unlock.
- iOS: a refused Keychain delete during "Delete everything", if one can be
  induced.
