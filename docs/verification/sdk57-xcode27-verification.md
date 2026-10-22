# Expo SDK 57 patch and Xcode 27 verification

> Verified: 2026-10-11 (partial, see "Not verified")
>
> Scope: latest stable Expo SDK patch, aligned Expo modules, UIKit scene
> lifecycle for the iOS 27 SDK, iOS build on Xcode 27
>
> Later update: `chore: align expo sdk 57 patch versions` moved `expo` to
> `~57.0.29` with `npx expo install --fix`, and that is the version the
> repository uses now. The 57.0.27 figures below are what this note verified
> on 2026-10-11; builds at the later version are recorded in
> `hardening-and-residue-verification.md`.

## Target

The npm registry's `expo` dist-tags on 2026-10-11 list `latest` as 57.0.27
and `next` as 58.0.7 (beta). SDK 57 is still the latest stable major, so the
upgrade target is the 57.0.27 patch, not SDK 58.

## Changes

- `expo` `^57.0.0` to `~57.0.27`, with the `expo-*` ranges aligned to
  SDK 57.0.27 through `npx expo install` (expo-router 57.0.25, expo-blur
  57.0.3, and the rest). `npx expo install --check` then reported
  "Dependencies are up to date". A few lower bounds were left as they were
  (`expo-constants`, `expo-file-system`, `expo-font`, `expo-status-bar`); the
  lockfile resolves newer patches inside those ranges. React Native stays at
  0.86.3, React at 19.2.3. The lockfile was regenerated with Node 24.13.0 and
  npm 11.6.2.
- `expo-build-properties` `~57.0.22` added with
  `ios.enableSceneSupport: true`. The option needs SDK 57.0.23 or newer.
  After `npx expo prebuild --clean`, `Info.plist` declares
  `UIApplicationSceneManifest` with `EXExpoAppSceneDelegate`, and
  `AppDelegate` conforms to `ExpoReactNativeFactoryProvider`.
- Native dependencies on both platforms changed through Expo patch bumps,
  among them `expo-modules-core` (57.0.16 to 57.0.21), `expo-modules-jsi`
  (57.0.8 to 57.1.1), `expo-sqlite` (57.0.2 to 57.0.4), `expo-secure-store`
  (57.0.3 to 57.0.4), `expo-screen-capture` (57.0.2 to 57.0.4), and the dev
  client. No hand-written native code changed: the vault and scanner modules,
  the SQLCipher settings, and the backup format are as they were.
- `plugins/withSqlCipherOpenSsl.js` added and registered after `expo-sqlite`.
  The first Android build of this change, made from the repository's new home
  on a path with spaces, produced an APK without
  `lib/<abi>/libcrypto.so`, and `libexpo-sqlite.so` then failed to load
  (`NoClassDefFoundError: expo.modules.sqlite.NativeDatabaseBinding`).
  `expo-sqlite` declares the OpenSSL prefab package `compileOnly` and relies
  on the Android Gradle Plugin to package the shared library it finds on the
  CMake link line; AGP 8.12 only accepts link fragments that end in `.so`,
  and CMake quotes fragments whose path contains a space, so the library was
  dropped. The pre-upgrade build, made from the repository's earlier home
  on the internal disk in a path without spaces, packaged it, which is why the two APKs differed by that one file. The plugin
  appends a Gradle snippet to `android/app/build.gradle` that extracts
  `libcrypto.so` for every ABI from the same Maven artifact `expo-sqlite`
  links against (coordinate read from its `build.gradle`) and adds it as a
  jniLibs source, with `pickFirst` for the case where AGP packages it too.
  The database format, key handling, and SQLCipher build flags are unchanged.

## Quality gate

`npm install` is in sync, and `npx expo install --check` reports
"Dependencies are up to date". `npm run validate` passes: Prettier, ESLint,
TypeScript, Jest (14 suites, 59 tests), and Expo Doctor (21/21 checks).
`npm audit` reports 68 findings (1 critical). They were not triaged or
compared with the base lockfile.

## iOS

Covered: build, install, launch, and the first native screens. Nothing past
the first screen was driven.

- Xcode 27.0 (27A266a), iPhone 18 Pro simulator on iOS 27.0.
- `LANG=en_US.UTF-8 npx expo run:ios --device <iPhone 18 Pro UDID>`:
  Build Succeeded, 0 errors, 262 warnings (mostly ML Kit "no platform load
  command" linker warnings, as in earlier phases). The build installed and
  opened `com.naderalfakesh.securevault`.
- With Metro running, the dev client loaded the bundle (2160 modules) and
  showed the first-run onboarding screen, partly covered by the one-time
  dev-client menu sheet. The system log shows the app's `UIWindowScene`
  connecting and the dev-client URL arriving as a scene `UIOpenURLAction`.
  The log has no legacy-lifecycle warning and no crash.
- In a second, separate check without Metro, `xcrun simctl launch` started
  the app and it showed the native dev-client launcher. The Xcode 27 Device
  Hub command line saw the same simulator: `xcrun devicectl list devices`
  listed it, `xcrun devicectl device info details` reported iOS 27.0, and
  `xcrun devicectl device capture screenshot` captured the launcher. The
  Device Hub window itself was not used, and listing processes through
  `devicectl` failed.
- UIKit logs that `UIApplication` status bar style and hidden calls are
  deprecated and are no-ops on iOS 27. The calls come from the status bar
  components that `app/_layout.tsx` (expo-status-bar) and `PageViewer`
  (React Native `StatusBar`) render. The status bar was only seen on the
  native launcher. On SecureVault's own screens, including the dark image
  viewer, it was not checked. Styling may need to move to view controller
  based appearance; that is a follow-up.

## Not verified

These items are open. None of them is claimed as passing.

- iOS app journey under the scene lifecycle: PIN setup, the lock screen,
  unlock, biometric unlock, the background privacy overlay, auto-lock on
  return, adding a document, the scanner, and the share sheet. Auto-lock and
  the overlay rely on `AppState`, which the scene lifecycle now feeds, so this
  run is the most important one still missing. AXe 1.4.0 could not drive Xcode
  27 simulators, so the UI could not be automated.
- Installing over existing vault data. Only fresh installs were launched,
  while the SQLCipher, secure store, and lifecycle packages all changed.
- Status bar appearance on the app's own screens, in light and dark themes.
- Android journey over existing vault data. With the packaging plugin in
  place, `npx expo prebuild --platform android` and
  `./gradlew :app:assembleDebug` (JDK 17, NDK 27.0, AGP 8.12) produced an
  APK with `libcrypto.so` for all four ABIs, byte-identical to the one in the
  pre-upgrade build. A fresh install on an Android 16 (API 36) arm64 emulator
  loaded `libexpo-sqlite.so`, finished onboarding and PIN setup, and showed
  the Documents tab with the SQLCipher index created. Installing over
  existing data, the scanner, export and restore were not driven on Android.
- The Device Hub window, a physical device, and an iPad build.

## Handoff

Run from the repository root with Node 24 and `LANG=en_US.UTF-8`.

iOS journey (on the iPhone 18 Pro simulator, iOS 27):

```sh
npm install
npx expo prebuild --clean --platform ios
npx expo run:ios --device "iPhone 18 Pro"
```

Then: finish onboarding, set a PIN, add a document, open the app switcher
(the overlay should hide content), return (the lock screen should show),
unlock with the PIN and with simulated Face ID, open the scanner, share a
document, and open the image viewer in both themes to check the status bar.

Install over existing data. Build the base commit from a separate worktree
with its own install. Do not switch branches or reset in the worktree that
holds this change. Do not create a new simulator: reuse one from
`xcrun simctl list devices available` that holds no one else's vault data,
erase it first, and do not erase, reset, or uninstall the app on a simulator
that holds someone's vault data. The second
worktree adds its own `node_modules`, Pods, and DerivedData, so check the
15 GiB disk floor first.

```sh
# an existing simulator that holds no one else's data, erased for this check
xcrun simctl erase <UDID>

# base build, from a new worktree beside this one
git worktree add ../securevault-base 8068e81
cd ../securevault-base
npm ci
npx expo prebuild --clean --platform ios
npx expo run:ios --device <UDID>
# set a PIN and add a document, then stop this Metro

# this change, from the original worktree, installed over the base build
cd -
npx expo run:ios --device <UDID>
# unlock with the same PIN and open the document
```

When done, `git worktree remove ../securevault-base` removes only the base
worktree. Erase the simulator again with `xcrun simctl erase <UDID>` once
its data is no longer needed.

Android (needs at least 15 GiB free after the build; no emulator booted
while Gradle runs, `JAVA_HOME` set to a JDK 17 or 21: the JDK 25 JBR of
current Android Studio builds fails AGP's prefab step with a restricted
native access warning):

```sh
npx expo prebuild --clean --platform android
cd android && ./gradlew :app:assembleDebug --max-workers=4 --no-daemon
```

Then boot an emulator, install `app/build/outputs/apk/debug/app-debug.apk`
with `adb install -r`, start Metro with `npm start`, and repeat the journey
above.

Device Hub command-line evidence:

```sh
xcrun devicectl list devices
xcrun devicectl device info details --device <UDID>
xcrun devicectl device capture screenshot --device <UDID> --destination launch.png
```

## Follow-ups

- Remove `ios.enableSceneSupport` (and `expo-build-properties` if it has no
  other use) when upgrading to SDK 58, which supports scenes by default.
- Status bar styling under the scene lifecycle, if the check above shows a
  regression.
- Triage `npm audit` against the base lockfile.
