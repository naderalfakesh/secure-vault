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
| iOS build and run          | `npm run ios -- --device "iPhone 17 Pro"`                               |
| Android build and run      | `npm run android`                                                       |
| Regenerate native projects | `npx expo prebuild --clean` (`ios/` and `android/` are gitignored)      |
| Quality gate               | `npm run validate` (prettier, eslint, tsc, jest, expo-doctor)           |
| Single checks              | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` |

Local toolchain quirks: CocoaPods needs a UTF-8 locale (`LANG=en_US.UTF-8`),
Gradle needs `JAVA_HOME` pointing at the Android Studio JBR, and `expo run:ios`
only sees Apple Silicon simulators because `plugins/withMlkitSimulatorFix.js`
strips Google ML Kit's `EXCLUDED_ARCHS = arm64`. Do not remove that plugin.

## Structure

- `app/` Expo Router routes. The root layout owns the lock gate.
- `src/components`, `src/hooks`, `src/services`, `src/security`, `src/types` app code.
- `modules/expo-vault/` local Expo Module (Swift and Kotlin): AES-256-GCM with a
  Keychain or Keystore key, string and file storage, export and import.
- `plugins/` config plugins (Face ID string, biometric permission, ML Kit fix).
- `docs/` plan, ADRs (`docs/adr/`), verification notes, archived 2025 plan.

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
