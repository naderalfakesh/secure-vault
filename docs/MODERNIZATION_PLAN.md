# SecureVault modernization plan

Portfolio goal: make this the third senior-level React Native showcase next to
[Hakeemi](https://github.com/naderalfakesh/Hakeemi) (backend-driven product,
i18n, accessibility, testing) and
[Nadir Wallet](https://github.com/naderalfakesh/nadir-wallet) (native plugins,
crypto, monorepo). SecureVault's distinct story is **privacy-first, on-device
everything**: hardware-backed encryption, native document scanning, on-device
OCR, and on-device AI that never uploads a document.

Written 2026-09-07 against the codebase at commit `fix: resolve crypto and file
system issues` (2025-12-28) plus seven uncommitted files.

---

## 1. Where the project stands

| Area | Today | Problem |
| --- | --- | --- |
| Runtime | Expo SDK 53, RN 0.79, React 19.0, TS 5.8 | Four SDKs behind Hakeemi (SDK 57, RN 0.86, React 19.2, TS 6) |
| UI | Core RN components, emoji icons, StyleSheet colors inline, light mode only | No design system, no dark mode, no animations, no icon set |
| Lists | `FlatList` sized with `Dimensions`, thumbnails are the full source image re-encrypted | Slow lists, wrong on rotation and iPad |
| Images | RN `Image`, `Modal` for full screen, no zoom | image-toolset-modern already has the modern viewer to reuse |
| Camera | `expo-image-picker` camera, single photo, no edge detection, no crop, no multi-page | Does not feel like a scanner |
| OCR | ML Kit text recognition run at save time, blocking | Good foundation, wrong place in the flow |
| Data | Whole metadata index stored as one JSON string in the vault | No indexed search, rewrites everything on each change |
| Native module | Expo Modules API, Swift + Kotlin, AES-256-GCM, Keychain / Keystore | Solid base; whole-file in memory, no streaming, service name still `com.example.ExpoCryptoVault`, Face ID string says "your notes" |
| Security checks | Hand-rolled root paths, config hash, and `__DEV__` treated as tampering | **Dev builds are blocked from unlocking**, which is why the app never felt usable |
| Session | Biometric prompt then `router.replace('/documents')` | No route guard, no auto-lock, no background privacy screen |
| Backup | Encrypted JSON copied to the clipboard, restore by pasting | Not how a user backs anything up |
| Quality | 0 tests, no CI, no lint config, no README screenshots | Far below the bar of the other two apps |
| Naming | cryptoNoteVault, SecureVault, ExpoCryptoVault, secure-vault | Pick one before going public |

### Why it never felt like a user's app

1. **First run is a puzzle.** Lock screen shows "Unlock Vault" and "Create New
   Vault" side by side with no idea whether a vault exists. No onboarding, no
   explanation of what the app protects or where data lives.
2. **Every outcome is an `Alert`.** Success, failure, permissions, and copy
   confirmations all interrupt with system alerts (30+ call sites).
3. **Adding a document is a form, not a scan.** Pick a source, then fill title,
   category, and tags by hand. The app already knows the text (OCR) but asks
   the user to type what it could suggest.
4. **Nothing happens after you save.** No recently added, no reminders, no
   reason to open the app again. A vault app earns its place by telling you
   your passport expires in 90 days.
5. **The scary parts are exposed.** "Test Authentication" in settings, root
   detection alerts on launch, and security jargon in the About section.

---

## 2. Target user journey

### First run
1. Three-screen onboarding: what it stores, "never leaves your phone", how to
   unlock. Reduced-motion aware, skippable.
2. Set up unlock: biometrics if available, always a 6-digit PIN as fallback.
   The vault key is created automatically. There is no "create vault" button.
3. Land on an empty Home with one clear action: **Scan your first document**.

### Returning
1. Lock screen auto-prompts biometrics on appear. PIN fallback below.
2. Auto-lock after a configurable timeout in background; blur overlay when the
   app switcher shows the app.
3. Deep links and cold starts always go through the lock gate (route guard in
   the root layout, not a `router.replace`).

### Home
- Search field at the top (full-text over titles, tags, and OCR text).
- **Expiring soon** row driven by dates extracted from documents.
- **Recent** row.
- Category folders with counts.
- Prominent Scan button (tab-bar center or floating).

### Add a document
1. **Scan** with the native document scanner: edge detection, auto-capture,
   perspective correction, multi-page. Import from Photos or Files stays as a
   secondary path.
2. **Processing sheet** runs OCR and on-device AI, shows progress per step, and
   never blocks the UI thread.
3. **Confirm sheet** arrives prefilled: suggested title, category, tags, and
   extracted key fields (document number, name, issue and expiry dates). The
   user corrects and taps Save.
4. Toast with "View" action. No alert.

### Document detail
- Viewer first: pinch-zoom pages (reuse the image-toolset-modern viewer), PDF
  rendering, page strip for multi-page.
- Metadata sheet below or behind a handle: category, tags, dates, extracted
  fields with masking for numbers.
- Actions: rename, move, share (temporary decrypt with warning and cleanup),
  delete with undo snackbar.

### Settings
- Security: auto-lock timeout, require biometrics for share, privacy screen
  toggle, change PIN.
- Backup: export an encrypted `.vault` file protected by a passphrase, restore
  from file. Explains the key hierarchy in one sentence.
- Appearance: system / light / dark.
- About: the security model in plain words, link to the repo.

---

## 3. Target stack

| Area | Choice | Why |
| --- | --- | --- |
| Runtime | Expo SDK 57, RN 0.86, React 19.2, TypeScript 6, New Architecture, React Compiler | Matches Hakeemi and image-toolset-modern |
| Navigation | Expo Router 57, typed routes, tabs with a lock gate in the root layout | Route guard replaces ad-hoc `router.replace` |
| Styling | Unistyles 3 with tokens, dark mode, Dynamic Type | Already proven in NadirNeoBank |
| Native feel | `expo-glass-effect` and `@expo/ui` where iOS 26 is available, graceful fallback | Same pattern as Nadir Wallet |
| Motion | Reanimated 4 + Gesture Handler 2, `react-native-worklets` | Viewer gestures, sheets, list transitions |
| Lists and images | FlashList 2, `expo-image` with native thumbnails | Replace FlatList + full-image thumbnails |
| Scanning | Native module wrapping VisionKit `VNDocumentCameraViewController` (iOS) and ML Kit Document Scanner (Android) | Free edge detection, crop, and multi-page from the platform |
| OCR | Keep ML Kit text recognition; consider Apple Vision on iOS | Already works |
| On-device AI | Adapter: Apple Foundation Models (iOS 26 with Apple Intelligence), Gemini Nano via ML Kit GenAI (supported Android devices), heuristic fallback (regex dates, keyword categories) | The portfolio story is the adapter and the fallback, not the model |
| Storage | `expo-sqlite` with SQLCipher enabled and FTS5, key supplied by the vault module | Indexed search, no JSON rewrite |
| Vault module | Keep Expo Modules API, modernize: chunked file encryption, native thumbnail generation, biometric-bound key access, StrongBox where available, proper service identifiers | Expo Modules is the right tool here and shows breadth next to the Wallet's Nitro plugins |
| Backup | Passphrase-derived key (PBKDF2 or Argon2 in native), encrypted file via `expo-sharing` and `expo-document-picker` | Portable across devices |
| Security | `expo-screen-capture`, background blur, auto-lock, `expo-device` rooted check as a warning, not a block | Never block dev builds |
| Quality | Jest + React Native Testing Library, Maestro flows, ESLint + Prettier, Expo Doctor, GitHub Actions CI | Same bar as Hakeemi |
| Docs | README with GIF tour, `docs/adr/`, security model page, roadmap | Same shape as the other two repos |

Explicitly out of scope: cloud sync, accounts, multi-device sharing, iCloud or
Drive backup. The pitch is on-device only.

---

## 4. Phases

Each phase ends with a green `npm run validate` (lint, types, tests) and a
short verification note in `docs/verification/`. Small commits, one concern
each, conventional commit messages.

### Phase 0: Baseline and cleanup
- Review the seven uncommitted files and the untracked `useSecurityStatus`
  hook. Commit what is wanted, drop the rest.
- Pick the final name (recommendation: **SecureVault**, repo renamed to
  `secure-vault`). Fix bundle ids, Keychain service name, Face ID usage string,
  scheme, and app slug in one commit.
- Delete `assets/*.backup`, move `rnsec-report.*` out of the repo root, add
  them to `.gitignore`.
- Tag the current state as `legacy-v1`, the way Hakeemi did.

### Phase 1: Platform upgrade
- Upgrade to Expo SDK 57 following the SDK 54, 55, 56, 57 notes in order.
  Expect `expo-file-system` API changes (the code already mixes legacy and
  `File`/`Paths` APIs) and ML Kit pod changes.
- Enable React Compiler, typed routes, TypeScript 6 strict.
- Rebuild dev clients for iOS and Android and prove the existing flows still
  work.
- Add ESLint, Prettier, Jest with RNTL, `npm run validate`, and a CI workflow.
- Fix the dev-build block in `securityChecks.ts` immediately: rooted or
  tampered becomes a warning banner, never a locked door.

### Phase 2: Foundation for the new UI
- Unistyles 3 tokens: color, spacing, radius, type scale, light and dark.
- Design-system primitives: Button, Sheet, Toast, ListRow, Chip, EmptyState,
  Skeleton, IconButton with a real icon set (`@expo/vector-icons` Lucide or
  SF Symbols via `expo-symbols`).
- Root layout with lock gate, tabs (Home, Documents, Settings), and the Scan
  action.
- Replace every `Alert.alert` with sheet, toast, or inline state. Keep native
  alerts only for destructive confirmations.

### Phase 3: Data layer
- `expo-sqlite` with SQLCipher and FTS5. Schema: documents, pages, fields,
  tags. Migration that imports the existing JSON metadata index.
- Repository layer with typed queries; hooks built on it. TanStack Query is
  optional here, since the data is local and synchronous enough.
- Native thumbnail generation in the vault module (resize on write), and
  chunked encryption for large PDFs.
- Unit tests for the repository with an in-memory vault mock.

### Phase 4: Onboarding and unlock
- Onboarding screens, PIN setup with hashing in native, biometric enrollment.
- Lock screen with auto-prompt, PIN fallback, and lockout after failed
  attempts.
- Auto-lock timeout, background blur, screen-capture protection.
- Maestro flow: fresh install to first document.

### Phase 5: Scanning
- Native document scanner module (VisionKit + ML Kit Document Scanner) exposed
  as `scanDocuments(): Promise<ScannedPage[]>` with multi-page results.
- Import from Photos and Files as secondary paths.
- Processing sheet with per-step progress, cancellable.

### Phase 6: On-device intelligence
- `DocumentIntelligence` adapter interface: `suggest(ocrText) ->
  { title, category, tags, fields[] }`.
- Implementations: Foundation Models on iOS 26 when available, Gemini Nano on
  supported Android, heuristic fallback everywhere. Capability detection at
  runtime, shown honestly in Settings.
- Expiry extraction feeds the Home "Expiring soon" row and optional local
  notifications.
- Tests for the heuristic implementation and the adapter selection.

### Phase 7: Viewing and sharing
- Zoomable page viewer from image-toolset-modern, page strip for multi-page.
- PDF rendering (native PDFKit / PdfRenderer view in the module, or
  `react-native-pdf`).
- Share with temporary decrypt, biometric step-up if enabled, and guaranteed
  cache cleanup.
- Delete with undo.

### Phase 8: Backup and restore
- Passphrase-protected encrypted export to a file; restore from file with
  validation and progress.
- Document the key hierarchy: device key in Keychain / Keystore, backup key
  derived from passphrase, never stored.

### Phase 9: Polish and release evidence
- Accessibility pass: labels, roles, Dynamic Type, reduced motion, 44 pt
  targets. VoiceOver and TalkBack walkthrough.
- README rewrite with GIF tour, architecture diagram, security model, and the
  "rebuilt from a 2025 prototype" story. ADRs for the scanner module, SQLCipher,
  and the AI adapter.
- iOS, iPad, and Android build evidence. Make the repo public.

---

## 5. Risks and honest caveats

- **On-device AI availability is narrow.** Foundation Models need iOS 26 on an
  Apple Intelligence device; Gemini Nano needs a recent Pixel or Samsung
  flagship. The heuristic fallback must be good enough that the app is complete
  without either. The README should say exactly which devices get which tier.
- **SQLCipher in expo-sqlite** is a build-time option; verify it against SDK 57
  and the New Architecture before committing to it in Phase 3.
- **The SDK jump is four versions.** Do it one SDK at a time and build after
  each, or the failure surface is too large to debug.
- **Scanner module scope.** Wrapping the platform scanners is a few hundred
  lines of Swift and Kotlin; writing a custom edge detector is not. Wrap.
- **Reuse before writing.** The image viewer (image-toolset-modern), theme and
  security patterns (NadirNeoBank), PIN hashing (Nadir Wallet), and testing
  setup (Hakeemi) already exist in sibling repos.
