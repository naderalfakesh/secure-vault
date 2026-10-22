# Repository guidance

Read [`docs/MODERNIZATION_PLAN.md`](docs/MODERNIZATION_PLAN.md) before starting
work. It is the source of truth: the target user journey, the target stack, and
the nine phases with their scope. Verification notes for finished phases live in
[`docs/verification/`](docs/verification/).

## Commands

| Task                       | Command                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| Install                    | `npm install` (Node 24, see `.nvmrc`; npm, not yarn or pnpm)            |
| Start Metro                | `npm start`                                                             |
| iOS build and run          | `npm run ios -- --device "iPhone 18 Pro"` (Xcode 27, iOS 27 simulator)  |
| Android build and run      | `npm run android`                                                       |
| Regenerate native projects | `npx expo prebuild --clean` (`ios/` and `android/` are gitignored)      |
| Quality gate               | `npm run validate` (prettier, eslint, tsc, jest, expo-doctor)           |
| Single checks              | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` |

Local toolchain quirks: CocoaPods needs a UTF-8 locale (`LANG=en_US.UTF-8`),
and Gradle needs `JAVA_HOME` pointing at a JDK 17 or 21 (the JDK 25 Android
Studio JBR fails AGP's prefab step) and must run with `--max-workers=4` while
no emulator is booted.

Required native config. Do not remove any of it:

- `plugins/withMlkitSimulatorFix.js` strips Google ML Kit's
  `EXCLUDED_ARCHS = arm64`, so `expo run:ios` sees Apple Silicon simulators.
- `plugins/withSqlCipherOpenSsl.js` packages SQLCipher's `libcrypto.so`,
  which AGP drops when the project path contains spaces.
- The `expo-sqlite` plugin options `useSQLCipher: true` and `enableFTS: true`
  in `app.json`. Without SQLCipher the index would be plain SQLite (the
  adapter refuses to open it, `SQLCIPHER_UNAVAILABLE`), and without FTS5
  search fails.
- `expo-build-properties`: `ios.usePrecompiledModules: false`, because
  prebuilt Expo frameworks are tied to one Swift version. SDK 58 generates a
  `SceneDelegate` itself, so `ios.enableSceneSupport` is no longer set, and it
  ships the ExpoModulesJSI Swift 6.4 interface strip, so the old
  `withJsiSwift64Fix` backport is gone.
- `plugins/withSecureVault.js` sets the Face ID string and the biometric
  permission.

## Structure

- `app/` Expo Router routes. The root layout owns the lock gate.
- `src/theme` Unistyles tokens (configured from `index.js` before the router loads).
- `src/components/ui` design-system primitives; screens never import from `react-native` for text or buttons.
- `src/data` SQLCipher index: `schema.ts` migrations, `DocumentRepository`, adapters (`expoSqlite.ts`, `testing/betterSqlite.ts`), `database.ts` (key from the vault, legacy import) with a `database.jest.ts` double.
- `src/services` `DocumentService` (files in the vault module, rows in the index) and `OcrService`.
- `src/features` session provider, document feature pieces; `src/hooks`, `src/security`, `src/types`, `src/utils`.
- `modules/expo-vault/` local Expo Module (Swift and Kotlin): AES-256-GCM with a
  Keychain or Keystore key, string and file storage, export and import.
- `plugins/` config plugins (listed above).
- `docs/` plan, security model (`docs/SECURITY.md`), ADRs (`docs/adr/`, numbered), verification notes (`docs/verification/`), screenshots (`docs/images/`), archived 2025 plan.

## Rules

- One concern per commit, single-line conventional commit message, no scope,
  no body, no AI attribution anywhere.
- Work through the plan's phases in order. Each phase ends with a green
  `npm run validate`, a native run on iOS (and Android when the change touches
  native code), and a note in `docs/verification/`.
- Security checks warn, they never block. Development builds must always be
  able to unlock the vault.
- Never `Alert.alert` for routine outcomes in new UI; use sheets, toasts, or
  inline state. Native alerts are for destructive confirmations only.
- Reuse before writing: image viewer from `../image-toolset-modern`, theme and
  security patterns from `../NadirNeoBank`, PIN hashing from `../NadirWallet`,
  testing setup from `../Hakeemi`.
- Preserve the `legacy-v1` tag and never rewrite pushed history.
- Identity is fixed: SecureVault, `com.naderalfakesh.securevault`, scheme
  `securevault`, Keychain service `com.naderalfakesh.securevault.vault`.
