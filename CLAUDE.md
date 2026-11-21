# Repository guidance

Read [`docs/MODERNIZATION_PLAN.md`](docs/MODERNIZATION_PLAN.md) before starting
work. It is the source of truth: the target user journey, the target stack, and
the nine phases with their scope. Verification notes for finished phases live in
[`docs/verification/`](docs/verification/).

## Commands

| Task                       | Command                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Install                    | `npm install` (Node 24, see `.nvmrc`; npm, not yarn or pnpm)                                          |
| Start Metro                | `npm start`                                                                                           |
| iOS build and run          | `npm run ios -- --device "iPhone 18 Pro"` (Xcode 27, iOS 27 simulator)                                |
| Android build and run      | `npm run android`                                                                                     |
| Regenerate native projects | `npx expo prebuild --clean` (`ios/` and `android/` are gitignored)                                    |
| Quality gate               | `npm run validate` (prettier, eslint, tsc, jest, expo-doctor)                                         |
| Single checks              | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`                               |
| Native tests (vault)       | `npm run test:native:ios` (`swift test`), `npm run test:native:android` (Robolectric, after prebuild) |
| Test vectors               | `npm run fixtures:vault` regenerates `modules/expo-vault/tests/fixtures`                              |
| App icons and splash       | `npm run assets:icons` renders `assets/*.png` from `src/brand/folio.ts`                               |

Local toolchain quirks: CocoaPods needs a UTF-8 locale (`LANG=en_US.UTF-8`),
and Gradle needs `JAVA_HOME` pointing at a JDK 17 or 21 (the JDK 25 Android
Studio JBR fails AGP's prefab step) and must run with `--max-workers=4` while
no emulator is booted.

Required native config. Do not remove any of it:

- `react-native.config.js` unlinks `@react-native-ml-kit/text-recognition`
  on iOS: Apple Vision reads text there (ADR 0011), and linking ML Kit would
  bring back Google's metrics and its arm64-simulator exclusion. Android
  keeps ML Kit.
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

- `app/` Expo Router routes, one-line re-exports of screens. The root layout owns the lock gate.
- `src/screens/<screen>/` one screen each: the screen, its `*.styles.ts`, `components/` (a folder per component), `hooks/`, `constants.ts`, `types.ts`, `helpers.ts`. The rules are in ADR 0010 (`docs/adr/0010-code-organisation.md`).
- `src/brand/folio.ts` the sealed folio mark as SVG: the icon and splash PNGs (`scripts/brand/make-icons.mjs`) and the in-app `Mark` all draw from it.
- `src/theme` Unistyles tokens (configured from `index.js` before the router loads).
- `src/components/ui` design-system primitives; screens never import from `react-native` for text or buttons (ESLint enforces it).
- `src/data` SQLCipher index: `schema.ts` migrations, `DocumentRepository`, adapters (`expoSqlite.ts`, `testing/betterSqlite.ts`), `DocumentDatabase` (the open/close/erase/restore state machine; key from the vault, legacy import) with the app's one instance in `database.ts`. Jest swaps only the adapter (`expoSqlite.mock.ts`, in-memory SQLite), so tests run the real class.
- `src/services` `DocumentService` (files in the vault module, rows in the index) and `OcrService` (`src/services/ocr`: Apple Vision on iOS, ML Kit on Android).
- `src/features` domain pieces shared by screens: session provider, documents, scan, backup, viewer, each with its hooks in `hooks/`.
- `src/hooks` (domain-free hooks), `src/utils` (pure helpers: `AppError` and `errorCode`, the `errorMessages` table, `DAY_MS`, `wait`, formatting, secure-store entries), `src/types` (domain types, `FIELD_KEYS`), `src/security`. Reuse these before writing a helper.
- Imports use `@/` for `src` and `@modules/` for `modules`; a native module is imported by its entry point, never by a file in its `src/`.
- Tests: unit tests in the `__tests__/` folder beside the code, route-level flow tests in `src/__tests__/`, helpers in `src/testing/`.
- `modules/expo-vault/` local Expo Module (Swift and Kotlin): AES-256-GCM with a
  key sealed to the Secure Enclave (iOS, ADR 0009) or held by the Keystore,
  string and file storage, export and import.
  Native tests: `Package.swift` and `tests/swift` (the format files as a Swift
  package), `android/src/test` (JUnit and Robolectric), both reading the
  vectors `tests/make-fixtures.mjs` writes to `tests/fixtures`.
- `modules/expo-document-ai/` local Expo Module: Apple Vision text recognition on iOS (`recognizeText`, ADR 0011), Apple Foundation Models (iOS 26+) and Gemini Nano (ML Kit GenAI Prompt API, pinned to `1.0.0-beta4` for Kotlin 2.2) for document suggestions; `src/features/intelligence/onDeviceModel.ts` checks every answer against the text (ADR 0008).
- `plugins/` config plugins (listed above).
- `docs/` plan, security model (`docs/SECURITY.md`), ADRs (`docs/adr/`, numbered), verification notes (`docs/verification/`), screenshots (`docs/images/`), archived 2025 plan.

## Rules

- Follow ADR 0010 for code layout: thin routes, styles in `*.styles.ts`, one
  component per file, files under 300 lines (components under 200).
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
