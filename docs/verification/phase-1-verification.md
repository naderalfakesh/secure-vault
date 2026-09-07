# Phase 1 verification

> Verified: 2026-09-07
>
> Scope: platform upgrade from Expo SDK 53 to SDK 57, quality tooling, CI

## Outcome

The prototype now runs on Expo SDK 57, React Native 0.86.3, React 19.2.3,
TypeScript 6.0, the New Architecture, and the React Compiler, with typed
routes enabled. `npm run validate` (Prettier, ESLint, strict TypeScript, Jest,
Expo Doctor) passes and runs in GitHub Actions on every push and pull request.

The upgrade went one SDK at a time, as the plan requires. Each step landed as
its own commit after `npx expo install --check`, `expo-doctor`, and `tsc`
passed. Native iOS builds ran at SDK 54, 55, and 57; the SDK 56 step was
verified at the dependency level only, because the machine's disk could not
hold another set of build intermediates and SDK 57 is documented upstream as a
version bump with no breaking changes over SDK 56.

| Step   | Commit    | Notes                                                                                                                                                                        |
| ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK 54 | `ac89c8c` | `@types/react` and `react-dom` had to be pinned by hand; legacy `expo-file-system` calls moved to `File` and `Directory`; icons made square for the config schema.           |
| SDK 55 | `4f4a3d8` | `newArchEnabled` and `edgeToEdgeEnabled` removed from app.json; config plugins now import from `expo/config-plugins`; `expo-font` pinned to dedupe a transitive SDK 57 copy. |
| SDK 56 | `1b6533f` | TypeScript 6; `splash` moved to the `expo-splash-screen` plugin; vault podspec raised to iOS 16.4; `expo-build-properties` dropped.                                          |
| SDK 57 | `99dc735` | Vault module imports `requireNativeModule` from `expo`; Hermes V1 regression warning cleared.                                                                                |

## The blocker that made the prototype unusable

`expo run:ios` failed on every SDK with "Unable to find a destination", and
Xcode listed no concrete simulators for the workspace. Google ML Kit's pods
set `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`, and Xcode 26 no longer
runs x86_64 simulator apps, so no destination was eligible on Apple Silicon.
`plugins/withMlkitSimulatorFix.js` reuses the fix from Nadir Wallet: a
`post_integrate` hook strips the exclusion from every generated xcconfig and
removes `LC_BUILD_VERSION` from the arm64 objects of the ML Kit frameworks so
they link for both device and simulator. The hook must run in `post_integrate`,
not `post_install`, because CocoaPods writes the aggregate target xcconfigs
after `post_install`. Commit: `164b046`.

## Native run evidence

| Platform        | Environment                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS, SDK 54     | Xcode 26.6, iPhone 17 Pro simulator, iOS 26.5          | Built and launched. Created a vault, unlocked with simulated Face ID, imported a photo from the library, saved it with OCR, relaunched and found the encrypted document and thumbnail intact.                                                                                                                                                                                                                                             |
| iOS, SDK 55     | same                                                   | Built and launched. Unlocked and decrypted the document saved under SDK 54.                                                                                                                                                                                                                                                                                                                                                               |
| iOS, SDK 57     | same                                                   | Built and launched with React Compiler and typed routes. Unlocked, decrypted the SDK 54 document, list loads through the reworked hooks.                                                                                                                                                                                                                                                                                                  |
| Android, SDK 57 | Android Studio JBR 21, Medium Phone emulator, API 36.1 | Not proven. `expo prebuild` and Gradle configuration succeeded and every library module compiled, but the app build failed with "No space left on device" after the emulator and parallel Gradle workers exhausted the machine's memory and disk. The generated project is unchanged from the SDK 57 template plus the local vault module, so the retry is a disk problem, not a code problem. It is the first item for the next session. |

The generated `ios/` and `android/` directories stay ignored.

## Quality gate

`npm run validate` passes:

- Prettier: pass, after one repository-wide formatting commit (`514f9b6`);
- ESLint (`eslint-config-expo` with the React Compiler rules): pass;
- TypeScript 6 strict: pass;
- Jest with React Native Testing Library: 1 suite, 1 test, rendering the lock
  screen against an in-memory vault mock;
- Expo Doctor: 21/21.

The ESLint pass required real fixes in legacy code, not rule suppressions:
`useRef(new Animated.Value()).current` became lazy `useState`, and the three
data-loading effects that set state synchronously became promise chains with
an `active` guard (`82fd9e1`). Test files must live outside `app/`, because
Expo Router treats `app/index.test.tsx` as a route and bundles the testing
library into the app.

## Issues found and deferred

- The documents list does not refresh after saving from the add sheet until
  the app relaunches. Phase 2 replaces this screen and its state handling.
- The lock screen shows "Unlock" and "Create" without knowing whether a vault
  exists. Phase 4 replaces it with onboarding and a lock gate.
- Google ML Kit text recognition still logs a benign `CCTPoli` registry fault
  on iOS. Phase 5 or 6 decides whether iOS OCR moves to Apple Vision, which
  would also remove the ML Kit simulator patch on that platform.
- `npm audit` reports advisories only through Expo tooling; no fix is applied
  because the suggested resolutions are major-version downgrades.

## Environment notes

The development Mac ran out of disk twice during the native builds. Only
regenerable caches were removed: Xcode DerivedData for this app, the Gradle
dependency cache, the CocoaPods and npm caches, and the emulator boot
snapshots. Nothing under the user's projects or personal folders was touched.
