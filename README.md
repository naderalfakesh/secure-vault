# SecureVault

**A document vault for passports, IDs, leases, and receipts, rebuilt from a 2025 prototype into a production-shaped React Native app with AES-256-GCM encryption under a Keychain- or Keystore-protected key, an encrypted search index, on-device scanning and text reading, and passphrase-protected backups.**

> SecureVault is a technical portfolio project. The screenshots show
> synthetic sample documents made for this purpose; it is not a published
> product.

[![CI](https://github.com/naderalfakesh/secure-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/naderalfakesh/secure-vault/actions/workflows/ci.yml)
[![Native tests](https://github.com/naderalfakesh/secure-vault/actions/workflows/native-tests.yml/badge.svg)](https://github.com/naderalfakesh/secure-vault/actions/workflows/native-tests.yml)

| Library                                                                                                                  | Viewer, always on a dark stage                                                                                      | Add a document                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| <img src="docs/images/redesign-ios-library-light.png" alt="Library with recent documents and collections" width="260" /> | <img src="docs/images/redesign-ios-viewer-dark.png" alt="Viewer showing a sample car insurance page" width="260" /> | <img src="docs/images/redesign-ios-add-light.png" alt="Add a document: scan, photo, Photos or a file" width="260" /> |

| Lock screen                                                                                                      | Backup hub (Android)                                                                                             | Dark mode (Android)                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| <img src="docs/images/redesign-ios-lock-dark.png" alt="Lock screen with a PIN keypad and Face ID" width="260" /> | <img src="docs/images/redesign-android-backup-light.png" alt="Backup hub with create and restore" width="260" /> | <img src="docs/images/redesign-android-library-dark.png" alt="Library in dark mode on Android" width="260" /> |

## The rebuild

The first SecureVault was a 2025 Expo SDK 53 prototype, preserved under the
[`legacy-v1`](https://github.com/naderalfakesh/secure-vault/tree/legacy-v1)
tag: a biometric prompt, a native AES-GCM module, and a JSON index that was
decrypted whole on every launch. It worked as a demo and fell over as a
product: no session, no PIN, no search index, one-shot photos, a backup only
its own device could read.

The rebuild kept the prototype's one good idea, a small Swift and Kotlin vault
module with a platform-protected key, and replaced everything around it in nine
phases: Expo SDK 57 and React Native 0.86 on the New Architecture, a real
session model, an encrypted SQLite index with full-text search, the platform
document scanners, on-device text reading with suggestions, a page viewer,
and a portable backup format. Each phase ended with a green `npm run validate`,
a native run, and a note under [`docs/verification/`](docs/verification/).
The runs covered both platforms except Phase 2 (the design system), which ran
on iOS only; Android was rebuilt in Phase 3. The
[modernization plan](docs/MODERNIZATION_PLAN.md) records the sequence and
[`docs/adr/`](docs/adr/) the decisions.

## Features

- Onboarding, a 6-digit PIN with escalating lockout, Face ID, Touch ID, or
  the device credential, auto-lock with a solid privacy cover, and an optional second
  biometric check before anything is shared
- Every file encrypted with AES-256-GCM under a device key: on iOS a random
  key stored in the Keychain, device-only and behind a user-presence check,
  read into app memory for each operation; on Android a non-exportable
  Android Keystore key. Thumbnails and pages encrypted separately so lists
  stay fast
- A SQLCipher index with FTS5 search over titles, tags, and extracted text;
  the prototype's JSON index migrates on first open
- VisionKit and ML Kit document scanning with multi-page capture, plus
  Photos and Files as secondary sources; PDFs rendered natively so one viewer
  handles everything
- On-device text reading with suggested titles, categories, tags, and typed
  fields; expiry dates surface on Home as "Expiring soon". Text is read on
  the device by Google ML Kit (and, on Android, scanned by the Google Play
  services document scanner). ML Kit sends Google usage and performance
  metrics, which include a per-installation identifier. Google says ML Kit
  does not send your images or the text it reads. This cannot be turned off (see
  `docs/SECURITY.md`)
- A pinch-zoom page viewer with a thumbnail strip, sharing under the
  document's own name with guaranteed cleanup, and delete with undo
- Passphrase-protected `.svbackup` files that hold the documents and the
  index and restore across platforms; a wrong passphrase fails before
  anything is touched
- Light and dark themes, Dynamic Type up to 2x, reduced-motion handling, and
  44 pt touch targets throughout the design system

The Android release build has been tested on a Pixel 9 (Android 17), see
[the device note](docs/verification/device-pixel9-android.md). A physical
iPhone, spoken VoiceOver and TalkBack passes, and the Maestro flow remain for
release sign-off.

## Architecture

```mermaid
flowchart LR
    Routes["Expo Router screens"] --> Session["Session provider: status, PIN, auto-lock"]
    Routes --> Features["Feature hooks and components"]
    Features --> Services["Document, backup, and OCR services"]
    Services --> Repo["Document repository over SQLCipher + FTS5"]
    Services --> Vault["expo-vault: Keychain / Keystore, AES-256-GCM streams, PDF pages, backups"]
    Services --> Intelligence["Document intelligence adapter (heuristic engine)"]
    Features --> Scanner["expo-document-scanner: VisionKit / ML Kit"]
    Repo --> Vault
```

Screens read one session status and only mount document routes while it is
`unlocked`. Services own the two stores a document lives in: encrypted bytes
in the vault module and searchable rows in the index. The vault module is
the only code that touches keys; the index key is stored encrypted under the
device key and the backup key derives from a passphrase, never from anything
stored in plain. The
[security model](docs/SECURITY.md) draws the full key hierarchy.

## Technology

| Area       | Choice                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | Expo SDK 58, React Native 0.88, React 19.3, New Architecture, React Compiler                                                                       |
| Navigation | Expo Router with typed routes and `Stack.Protected` guards                                                                                         |
| Styling    | Unistyles 3 with light and dark themes and a small accessible design system                                                                        |
| Native     | Two local Expo Modules in Swift and Kotlin: the vault and the document scanner                                                                     |
| Storage    | expo-sqlite with SQLCipher and FTS5; expo-secure-store for the PIN record and settings                                                             |
| Crypto     | AES-256-GCM in 1 MiB chunks, PBKDF2-HMAC-SHA256 for the PIN and backup keys                                                                        |
| Text       | ML Kit text recognition, a heuristic intelligence engine behind an adapter                                                                         |
| Quality    | Strict TypeScript 6, Jest with React Native Testing Library and a real SQLite, XCTest and JUnit with shared vectors, ESLint, Prettier, Expo Doctor |

## Quality

CI runs `npm run check` on every push: formatting, lint, strict types, and
the Jest suites. Expo Doctor runs in a workflow of its own, also weekly, so an
Expo patch release flags drift without failing the build. The repository tests run against a real
SQLite with FTS5; the vault module ships a Jest double so services and
screens run unchanged.

The vault module's own Swift and Kotlin code has native tests in a third
workflow. Both suites read the same vectors in
[`modules/expo-vault/tests/fixtures`](modules/expo-vault/tests/fixtures),
written by an independent Node implementation of the three file formats
(SVC1 streams, SVS1 string entries, SVB1 backups) from their spec. So each
platform is checked against bytes neither app wrote: altered, reordered and
cut chunks, wrong passphrases, unsupported headers, and backups damaged only
in their last entry, which must be refused before the restore touches the
vault. The Swift formats build as a plain Swift package and run with
`swift test` on the Mac; the Kotlin tests run on the JVM with Robolectric.

Native evidence covers iOS and Android development
builds on the simulator and the emulator for every phase except Phase 2
(iOS only), including a backup made on the iPhone simulator and restored on
the Android emulator. The release APK passed the Android checks on a Pixel 9
([device notes](docs/verification/device-pixel9-android.md)); the iPhone
pass is still to do. The per-phase records live under
[`docs/verification/`](docs/verification/).

## Project structure

```text
app/                     Expo Router routes: lock, setup, tabs, documents, settings
src/components/ui/       Accessible design-system primitives
src/features/            Session, auth, documents, intelligence, viewer
src/services/            Document, backup, and OCR services
src/data/                Repository, schema and migrations, SQLCipher adapter
src/theme/               Colors, tokens, typography, Unistyles setup
modules/expo-vault/      Swift and Kotlin vault: keys, encrypted files, PDF pages, backups
modules/expo-document-scanner/  VisionKit and ML Kit scanner
plugins/                 Config plugins: biometric strings, ML Kit simulator fix, SQLCipher OpenSSL
docs/                    Plan, security model, ADRs, verification records, screenshots
```

## Run locally

Prerequisites: Node.js 24 (`.nvmrc`), npm, Xcode 27 with CocoaPods for iOS, and
Android Studio with an SDK and JDK 17 or 21 for Android (the JDK 25 that
recent Android Studio builds bundle fails the Gradle prefab step). Expo Go is
not a supported runtime; the app needs a development build for its native
modules.

```sh
npm install
npm run validate
npx expo prebuild --clean
npm run ios
# or pick a simulator from `xcrun simctl list devices available`:
# npm run ios -- --device "<simulator name>"
# or
npm run android
```

On the iOS simulator, enrol Face ID under Features before the first unlock;
VisionKit's scanner needs a physical iPhone, and the simulator has no
camera, so there the photo row is disabled and documents come from Photos or
Files. On the Android emulator, set a screen lock first
(`adb shell locksettings set-pin 1234`) because the vault key requires one.

| Command                           | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `npm start`                       | Start Metro for the development client                     |
| `npm run ios` / `npm run android` | Generate and run a native build                            |
| `npm test`                        | Run the Jest suites                                        |
| `npm run test:native:ios`         | Run the vault's Swift tests on the Mac (`swift test`)      |
| `npm run test:native:android`     | Run the vault's Kotlin tests (after `expo prebuild`)       |
| `npm run validate`                | Run formatting, lint, strict types, tests, and Expo Doctor |

## Historical context

The prototype's plan and its state before the rebuild are kept in
[`docs/legacy-project-plan.md`](docs/legacy-project-plan.md) and the
[legacy baseline](docs/verification/legacy-baseline.md). The
current interface, screenshots, and native code are new work.

## Contributing and license

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md): fictional documents
only, single-line conventional commits, and `npm run validate` before review.
The code is available under the [MIT License](LICENSE).
