# Code organisation refactor

> Verified: 2026-11-18 (host: `npm run validate`; iOS Release build on the
> iOS 27 simulator, see "Device run")
>
> Base: `main` at `7c50cca`. Rules: [ADR 0010](../adr/0010-code-organisation.md).

## What changed

Behaviour is unchanged. The code is reorganised so that every file does one
thing, in a series of small commits, each green on its own.

- **Routes** under `app/` are one-line re-exports. The screens live in
  `src/screens/<screen>/`: the composing screen, its styles file,
  `components/` (a folder per component), `hooks/`, `constants.ts`,
  `types.ts` and tested `helpers.ts`. Library, document viewer, add
  document, settings, backup, change PIN, auto-lock, protection, lock,
  vault unavailable, onboarding, choose PIN and biometrics.
- **Layouts** keep only their navigators. The lock gate, launch splash and
  tab bar moved to `src/features/navigation/`.
- **UI primitives** (`src/components/ui/`) are a folder each. Sheet, Toast,
  ListRow and Icon are split into their parts. `ui/index.ts` exports the
  same names.
- **Feature components** (scan, viewer, backup sheets, onboarding art,
  splash handoff, security overlay) follow the same layout.
- **SessionProvider** went from 1,030 lines to 172. It now wires one hook
  per concern (status, settings, lockout, availability, auto-lock,
  biometric and PIN unlock, setup, notices, capture, erase) around pure,
  tested decisions in `helpers.ts`.
- **Services and data**: `DocumentService` (832 lines) is now
  `src/services/document/` (index, import, storage, deletion, residue), and
  `BackupService` (604) is now `src/services/backup/` (format, passphrase,
  export, restore). The database store and the repository are split by
  concern. The old import paths re-export the new modules, so mocks and
  spies still reach the code the app runs.
- **Shared pieces**: `useDelayed`, `useMountedRef` and
  `useBlockHardwareBack` (`src/hooks`), and `tabBarClearance`
  (`src/features/navigation`).
- **Fix**: the passphrase rule's spoken state ("met", "not met") is now
  translated.
- **ESLint enforces the rules**: source files stay under 300 lines and
  components under 200 (blank lines and comments not counted), and no
  `.tsx` calls `StyleSheet.create`.

## Checks

| Check                      | Result                                                  |
| -------------------------- | ------------------------------------------------------- |
| `npm run validate`         | Green: 118 suites, 1,050 tests (from 907), Doctor 20/20 |
| Largest source file        | 231 lines (`src/data/DocumentRepository.ts`)            |
| Largest component          | 194 lines (`src/screens/library/LibraryScreen.tsx`)     |
| `StyleSheet.create` in tsx | None (lint rule)                                        |

The six Expo packages behind on patch releases were updated in their own
commit (`chore: update expo patch releases`).

## Device run

| Run                                      | Result                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 27 simulator, Release, iPhone 18 Pro | Native splash, then the lock screen. PIN unlock reaches the Library (rail, recent list, tab bar). The viewer opens a document and its Details sheet; Settings and the Add a document sheet render. |

## Owed

- An Android run of the refactored screens. Native code changed only in
  two comments, so the iOS run covers the JS.
