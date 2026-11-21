# Code organisation review

> Verified: 2026-11-21 (host: `npm run validate`; iOS 27.2 simulator,
> iPhone 18 Pro, the installed debug build loading this branch from Metro)
>
> Base: `main` at `219acb0`. Branch: `refactor/code-organisation`.

A review of the whole TypeScript codebase for duplication, layout drift and
weak typing, followed by the refactor. Native code (Swift, Kotlin), the
config plugins and `app.json` are untouched.

## What changed

- **Imports.** `@modules/*` replaces `../../../modules/…` (about 90 import
  lines); nothing imports a file inside a module's `src/` any more.
  `import/order` and `import/no-duplicates` are errors.
- **One home for shared helpers.** `errorCode` (was hand-written in 15
  places), `DAY_MS` (3), `wait` (3), `parseTags` (2), a mounted ref (4), the
  secure-store entry names and options (5 files, one of them a hand-kept
  list the reinstall wipe depends on), the document field keys (`'expires'`
  was a literal in 5 files, one of them SQL).
- **Documents.** The legacy `useDocuments` hook (13 members, 4 used) is
  `useDocumentList`; its dead mutation, search and category code and the
  matching repository methods are gone. `LibraryCard` and `LibraryRow` moved
  to the library screen; the `getThumbnail` prop no longer passes through
  four components.
- **Auth and session.** One lockout countdown hook instead of two, one erase
  sequence instead of two copies, the session hooks renamed so no two hooks
  share a name (`useVaultReset`, `usePinAuth`), screens named after their
  folders (`SetupPinScreen`, `SetupBiometricsScreen`, `UnavailableScreen`).
- **Design system.** `BackBar` and `TitledScroll` replace four hand-copied
  back rows and three identical title layouts; viewer and control colours
  come from the theme (no colour literal is left outside `src/theme`,
  `src/brand` and the onboarding art); dead tokens, dead `ListRow` props and
  an unused string were removed; accessibility props are forwarded
  consistently.
- **Services.** The decrypted cache file names and the sweep that removes
  them are written from one table (`cacheNames.ts`), pinned by a test.
- **Types and lint.** `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch` are on. ESLint errors on
  `any`, on a non-null `!`, and on `Text`, `Button`, `Switch`, the
  touchables and `Alert` imported from `react-native` outside the design
  system.
- **Tests.** The 25 colocated unit tests moved into `__tests__/`; the vault,
  secure-store, app-state and unlocked-render boilerplate copied across up
  to 30 test files lives in `src/testing/`.
- ADR 0010 records the conventions.

## Behaviour changes

Each is its own `fix:` commit with tests.

| Change                | Before                                                                                                                                     | After                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Passphrase length     | The service counted UTF-16 units, the rule ticks counted code points: four emoji enabled Create while the "8 characters" tick showed unmet | Every rule counts code points                              |
| OCR text check        | Only ASCII letters counted, so Arabic, Chinese or Cyrillic text was judged noise and not indexed                                           | Letters of any script count; digits still do not           |
| Document update       | Read outside the transaction and wrote every column, so overlapping edits could lose one, and an `undefined` cleared the stored text       | Reads and writes in one transaction, only the fields given |
| Biometrics setup step | A failed settings write left both buttons disabled                                                                                         | The step becomes usable again                              |
| Thumbnails            | The in-memory cache kept paths of files the lock sweep had deleted                                                                         | A cached path counts only while its file exists            |
| Change PIN            | The lockout countdown started at 0 for one frame                                                                                           | It starts from the stored lockout                          |

## Checks

- `npm run validate`: Prettier, ESLint, `tsc`, Jest (123 suites, 1091 tests;
  1066 before: tests of deleted code went, tests for the fixes and the new
  helpers came) and Expo Doctor (20 of 20).
- `npx expo export --platform ios` and `expo export:embed` bundle the app,
  so Metro resolves the `@modules` alias in a release bundle.
- iOS simulator, by hand: unlock with the PIN, Library (list, thumbnails,
  Expiring soon rail), viewer, details sheet, Settings, Backup, Lock now,
  unlock again (thumbnails return), Add a document sources.

## Not checked

- Android was not run. No native code changed, and the JavaScript is shared.
- On iOS these flows were not exercised by hand and rest on the Jest flow
  tests: importing and saving a document, creating and restoring a backup,
  Delete everything, first-run setup, Change PIN.

## Left for later

Found in the review and deliberately not done here, because each changes
structure that the security tests pin down or changes what the user sees:

- `SessionProvider` publishes one context of 29 fields; splitting state from
  actions would cut re-renders in the dozen consumers that only call actions.
- The add-document flow keeps its phase in four `useState`s that sub-hooks
  set from outside; one reducer would make the moves explicit.
- Errors are plain objects with a `code`; a typed `AppError` and one
  code-to-sentence table would replace four mappers.
- `database.ts` is a module-level state machine with a hand-written Jest
  double; a class with injected dependencies would remove the double.
- Deleting a document and Delete everything swallow file-removal failures.
- Spacing literals off the token scale (`14`, `10`, `6`) and nine separate
  pressed styles in the design system.
- Four test files are over 900 lines and split cleanly along their
  `describe` blocks.
