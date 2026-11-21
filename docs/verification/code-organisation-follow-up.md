# Code organisation follow-up

> Verified: 2026-11-21 (host: `npm run validate`; iOS 27.2 simulator,
> iPhone 18 Pro, the installed debug build loading this branch from Metro)
>
> Base: `main` at `dc87781`. Branch: `refactor/left-for-later`.

The seven items the [code organisation review](code-organisation-review.md)
left for later. Native code (Swift, Kotlin), the config plugins and
`app.json` are untouched.

## What changed

- **Errors.** An error the app raises is an `AppError` with a `code` from one
  list (`src/utils/AppError.ts`); `BACKUP_PARTIAL` is a `PartialRestoreError`
  with a typed `stoppedAt`. Sentences come from one table and one resolver
  (`src/utils/errorMessages.ts`); the session, backup, scan and plain mappers
  are thin callers that pass their own overrides. Every message and code is
  what it was.
- **Add-document flow.** `flowReducer.ts` holds the phase, origin, problem,
  step, save error and saved id, with one action per event. The three hooks
  dispatch instead of calling each other's setters. Held plaintext copies
  stay in `useHeldCopies`.
- **Index.** `DocumentDatabase` is a class that holds the open, abandoned and
  erasing state in fields and takes the SQLite adapter in its constructor.
  The hand-written Jest double (`database.jest.ts`) and its
  `moduleNameMapper` entry are gone: Jest replaces only the adapter with an
  in-memory SQLite, so every flow test now runs the real state machine.
- **Session.** Two contexts, `useSessionState()` and `useSessionActions()`;
  `useSession()` is gone. The actions object keeps one identity for the
  provider's lifetime (`updateSettings` and `resetLostPin` read their state
  through a ref), so the components that only call actions no longer render
  on every state change. A test pins both.
- **Tokens.** `theme.inset` names the half steps (2, 6, 10, 14) that were
  literals in 36 places; six one-off values became named constants in their
  styles file. `theme.pressed` and two shared fragments replace the separate
  pressed styles.
- **Tests.** The four files over 900 lines are 19 files of 116 to 458 lines,
  with the same 231 tests under the same names; their shared setup is in
  `src/testing/`.
- ADR 0010 records the error, state and test-size conventions.

## Behaviour changes

| Change              | Before                                                                                                                              | After                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deleting a document | A file that could not be removed was ignored and the row was deleted: the encrypted file stayed in the vault with nothing naming it | Every file is attempted, the main file last. If one stays, the document stays listed with the existing "Couldn't delete" message; deleting again finishes |
| Undo copy           | A delete that failed left the decrypted undo copy in the cache until the next lock                                                  | The copy is removed before the failure is reported                                                                                                        |
| Delete everything   | Only the two index entries were checked afterwards, so the erase could report success with encrypted documents left                 | Any entry left fails the erase with the existing "incomplete" message; a second attempt can finish it                                                     |
| Settings            | Two changes made before a render: the second overwrote the first                                                                    | The second builds on the first                                                                                                                            |
| Chip, pressed       | Opacity 0.8                                                                                                                         | 0.85, the shared value                                                                                                                                    |
| Create-flow test    | Passed only when an earlier `describe` had reset the app state                                                                      | Resets it itself                                                                                                                                          |

## Checks

- `npm run validate`: Prettier, ESLint, `tsc`, Jest (143 suites, 1126 tests;
  1091 before) and Expo Doctor (20 of 20). The suite was green after each of
  the commits.
- iOS simulator, by hand: unlock with the PIN, Library, Add a document from
  Photos through reading, details and Save to vault (5 documents, toast),
  the viewer and details sheet of the new document, Delete with the Undo
  toast (4 documents), Settings, Privacy cover off and on, Lock now. Metro
  logged no error or warning.

## Not checked

- Android was not run. No native code changed.
- Delete everything was not run on the simulator: it would empty the vault
  that holds the shared sample documents. The stricter check rests on Jest.
- A file removal that fails cannot be provoked by hand; it rests on Jest.
- Backup create and restore, first-run setup and Change PIN were not
  exercised by hand.

## Left as it is

- The mappers still differ on purpose: the session and backup sentences show
  an unknown error's own message, `plainErrorMessage` filters platform
  diagnostics and paths, and the scan sources never show it.

## Android delete (added 2026-11-21)

`delete` and `deleteFile` in the Android vault module called `File.delete()`
and ignored its result, so an entry the system refused to remove was reported
to JavaScript as deleted. Both now go through `VaultFiles.remove`: an entry
that is already gone counts as removed, one that is still there rejects with
`DELETE_FAILED` or `DELETE_FILE_FAILED`, and its stored nonce is kept. The
restore's wipe uses the same helper.

- `npm run test:native:android`: 25 tests in 5 classes pass, 3 of them new
  (`VaultFilesTest`).
- `./gradlew :app:assembleDebug` builds; the APK installs over the existing
  app on the `Hakeemi_API36` emulator (Android 16) and starts to the lock
  screen with this branch's JavaScript from Metro.
- Not checked: deleting a document on the emulator. Its vault did not open
  with the recorded test PIN, and the vault was left as it was.
