# Redesign step 7: Backup hub, restore and recovery (J6), F2, F4–F6, F10

Branch `feat/redesign-backup`, from `feat/redesign-scan` 69a31ad (main with
SDK 58 and the polish pass, T7b restore preflight, core screens, onboarding
and scan). Scope is handover §9 step 7: the J6 Backup hub, the create and
restore sheets, cooperative restore cancel (F2), typed restore outcomes and
the phase signal (F4, F5, F6), "Last created on this phone" (F10), and the
"Create a backup first" link (§11.9).

## Gate status

| Gate                    | Status                                       | Effect here                                                     |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| G6 (restore hardening)  | T7b on this branch; its native QA is running | The hub is built; merging waits on that QA as before.           |
| T8 (export staging)     | Satisfied                                    | "Create a backup first" is shown in Delete everything.          |
| G11 (one restore entry) | Kept at every commit (see below)             | One entry, in the hub; no route, link or file type for backups. |
| D22 (compatibility)     | Open (§12)                                   | `BACKUP_UNSUPPORTED` copy stays generic.                        |

No backup-format, crypto, key or schema change. The native change is a cancel
flag read between entries; nothing it touches writes.

## G11 at every commit

- `6d43b5a`, `9a319c1`, `ca4a3e2`: native, service and settings work only.
  The one entry is still the Settings row.
- `a186a63` adds `app/settings/backup.tsx` and, in the same commit, removes
  the Export and Restore rows and both sheets from `app/(tabs)/settings.tsx`,
  which gets one Backup row instead. `src/__tests__/restore-entry.test.tsx`
  lands with it: no button in Settings is labelled "Restore…", the hub has
  exactly one, only `app/settings/backup.tsx` among the route files calls
  `inspectBackup`, `restoreBackup` or `cancelRestore`, the hub reads no route
  parameters or `Linking`, no route file is named for restore, there is no
  `+native-intent`, and neither `app.json` nor any config plugin declares an
  intent filter, document type, imported UTI, associated domain or
  `svbackup`.
- `b9f6c5d`, `e273eda`, `7c38066` change the hub's sheets and Settings'
  Delete sheet; the entry count stays one. The Delete sheet's new link goes
  to the hub, not to a restore.

The hub is behind the lock gate like every other unlocked route and takes no
parameters, so a `securevault://settings/backup` link can at most open the
hub after unlock; it cannot pick a file or start a restore.

## F2: cooperative restore cancel

- `BackupContainer.read` (Kotlin and Swift) takes `cancelled` /
  `isCancelled`, default false. It is asked after the key is derived (the
  PBKDF2 call itself cannot be interrupted), before every entry of the verify
  walk (a `beforeEntry` hook in `walk`), once after the verify walk, and once
  after the preflight, right before the restore walk. It is never asked in
  the restore walk, because the first `handle` call wipes the vault. A true
  answer throws `CancelledException` / `BackupError.cancelled`; `read`'s
  `finally`/`defer` sweep empties `restore-staging` as for every other
  refusal.
- The module keeps one flag (`AtomicBoolean` on Android, a small
  `NSLock`-guarded `RestoreCancelFlag` on iOS). `Function("cancelRestore")`
  sets it and returns at once. `importBackup` clears it when it starts, so a
  stale request from an earlier restore cannot stop the next one. The
  refusal maps to `BACKUP_CANCELLED` beside the other pre-wipe codes; the
  `cleared` branch comes first, so it can never be reported after the wipe.
- Because `importBackup` runs on the module queue and may start after a
  cancel sent from the JS thread, `BackupService` remembers the request and
  sends it again on every Checking event until the first Restoring event.
- The JS slot is unchanged: `cancelRestore()` only acts while
  `restoreBackup` holds the `restore` slot and before the wipe boundary, and
  returns whether it sent the request.
- A cancelled restore: vault entries, the `_database_key`, the index (no
  `replaceDatabaseFile`, no reload) and both staging folders untouched or
  removed; the sheet returns to the inspect step with "Restore cancelled.
  Nothing was changed." and Restore enabled.

## F4–F6: phase signal and typed outcomes

- `restoreBackup` hands listeners `{ phase, done, total, wiped }`. `wiped`
  latches on the first `import` event and stays true for the rest of the
  call, including a `withKeyRecovery` retry that starts a new Checking pass.
- After the latch, any failure except `BACKUP_INDEX` is rethrown as
  `BACKUP_PARTIAL` with `stoppedAt` (the last Restoring event) and the
  original as `cause`. This covers `KEY_LOCKED` after the wipe (the native
  code keeps it for the retry) and a retry's own "unchanged" refusals, which
  say nothing about the first attempt's wipe. The window between the first
  Restoring event and the wipe (the check entry and the key probe) is
  reported as partial too: an over-warning, never a false "Nothing was
  changed".
- `KEY_LOCKED` before the latch keeps its code: "The device key was not
  unlocked, so nothing was changed. Try again."

| Code                                         | Sheet                                                                                                                                                                 | Buttons                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `BACKUP_PASSPHRASE`                          | Field error: That passphrase does not match this backup. Nothing was changed.                                                                                         | Restore and replace vault (enabled), Cancel |
| `BACKUP_CANCELLED` (new)                     | Info: Restore cancelled. Nothing was changed.                                                                                                                         | Restore and replace vault, Cancel           |
| `BACKUP_INVALID`                             | This file is not a SecureVault backup, or it is damaged. Nothing was changed.                                                                                         | Choose another file                         |
| `BACKUP_UNSUPPORTED`                         | This backup uses settings this version of the app doesn't support. Nothing was changed.                                                                               | Close                                       |
| `BACKUP_RESOURCE`                            | This device doesn't have enough free space or memory to restore this backup. Nothing was changed. (§7.1 wording; was memory only)                                     | Close                                       |
| `BACKUP_NO_SPACE`                            | T7b sentence, kept (not in §7.1): …enough free space… Nothing was changed. Free up some space and try again.                                                          | Close                                       |
| `BACKUP_PARTIAL`                             | Title "The restore didn't finish"; The restore stopped after the previous vault was removed. Restore the backup again.; FileCard "Stopped at entry X of N" when known | Restore again, Close                        |
| `BACKUP_INDEX`                               | Your documents were restored but the index could not be opened. Restore the backup again.                                                                             | Restore again                               |
| Other (`KEY_LOCKED` pre-wipe, staging, busy) | Its typed sentence, never the platform text                                                                                                                           | Restore and replace vault, Cancel           |
| Picker: header `BACKUP_INVALID`              | Danger toast: That file isn't a SecureVault backup. No sheet.                                                                                                         |                                             |
| Picker cancelled                             | Nothing                                                                                                                                                               |                                             |
| Success                                      | Toast "Vault restored: N entries", sheet closes, `router.navigate('/')` (Library); no relock                                                                          |                                             |

Checking shows "Checking X of N", "Step 1 of 2", the success callout
"Nothing has been changed yet." and Cancel ("Cancelling…" once pressed); the
sheet cannot be dismissed. From the first Restoring event: "Restoring X of
N", "Step 2 of 2", the brass "This can't be stopped." callout, no controls.

## Create, hub, F10, Delete everything

- Create sheet: intro, Passphrase (any script, `PassphraseField`),
  `StrengthMeter` (soft only; a "Weak" passphrase that meets the rules is
  allowed), hint, Repeat with "Passphrases match" / "The passphrases don't
  match yet.", the two enforced rules as met / not met rows, the info line,
  Create disabled until `passphraseProblem` is null. Busy: "Creating backup",
  "Encrypting X of N" with a percentage, the keep-open line, not
  dismissable. Error in the same sheet with Try again / Close, using the
  §7.7 sentence except for staging, busy and key codes, which keep their own.
  Export staging, the session gate before the share sheet, `sharePause`, the
  share race against the session's end, and the notices after a lock are
  moved unchanged from Settings (their tests moved with them).
- Hub: §7.7 card, Create a backup, "Last created on this phone: ‹date›"
  (hidden when unknown), Restore section with one row, footnote. While an
  export or restore from before the last lock still holds the slot, both
  controls are disabled and say so.
- F10: `src/features/backup/lastBackup.ts`, an ISO date in the secure store
  (`securevault.lastBackup`, this-device-only), written after the share sheet
  returns with the vault still unlocked; not written when the lock stopped
  the share. Delete everything clears it.
- Delete everything: "Create a backup first" (link role) closes the sheet
  and opens the hub; the native destructive alert is unchanged.
- Strings are in `src/features/backup/backupCopy.ts`.

## Kept intact

T7b refusals and sentences (only RESOURCE's wording changed, to §7.1),
export and restore staging and their guards, the R1/R2 cleanup order, the
service's one slot (M1), the restore running through a lock with its outcome
posted after unlock, and the picker and Inbox copy removal (N6). All earlier
tests for these pass unchanged or with their labels renamed.

## Tests

- Native host harnesses (outside the repository, with the local build files):
  each compiles the worktree's own `BackupContainer` and `VaultCrypto`
  unmodified (Kotlin on the JVM with openjdk 17, Swift as a Mac Catalyst
  binary), writes a real 5-entry container and restores it. Both failed to
  compile before the change and pass after: no cancel restores all 4
  entries; a cancel during the KDF stops before the first entry with no
  events; a cancel after verify entry 2 stops with exactly 2 events and
  nothing handled; a cancel at the last verify entry stops before the
  preflight; a cancel in the restore pass is ignored and all 4 are handled;
  `restore-staging` is empty after each cancel. The Swift run also checks the
  module flag's request and reset. Run with `harness/android/run.sh <module
android source dir>` and `harness/ios/run.sh <module ios dir>`; each
  deletes its build output.
- `src/services/__tests__/BackupService.test.ts`: cancel while checking
  (vault, `_database_key`, index, staging, extras, slot), the resend when the
  native call starts late, no cancel after the first Restoring event or with
  nothing running, partial with `stoppedAt` after a post-wipe `KEY_LOCKED`,
  partial for a retry cancelled after the wipe, `KEY_LOCKED` before the wipe
  kept, and every sentence.
- `src/features/backup/lastBackup.test.ts`: F10 read, write, malformed,
  refused store, clear.
- `src/__tests__/backup-hub.test.tsx` (moved from `settings-backup`): all
  earlier lock and share cases, plus inspect, wrong passphrase with no
  counter, Checking with Cancel and its outcome, the Restoring swap and the
  partial outcome, index, success to the Library, the non-backup toast, the
  cancelled picker, every refusal with its button, the create rules, soft
  strength, Arabic passphrase, busy step, failure with Try again, the backup
  date, and the Delete everything link.
- `src/__tests__/restore-entry.test.tsx`: G11 as listed above.
- `npm run validate` exits 0: prettier, eslint, tsc, 572 Jest tests in 71
  suites, expo-doctor 20/20.

## Native builds

Run once at the end, after checking that no other build was running and
memory was above 40% free (62%).

- Android: `npx expo prebuild --platform android`, then
  `./gradlew :expo-vault:compileDebugKotlin --max-workers=4` with openjdk 17:
  `BUILD SUCCESSFUL`, no warnings in `expo/modules/vault`.
- iOS: `npx expo prebuild --platform ios` (CocoaPods with `LANG=en_US.UTF-8`),
  then `xcodebuild -project ios/Pods/Pods.xcodeproj -target ExpoVault -sdk
iphonesimulator -configuration Debug ARCHS=arm64 -jobs 4`:
  `** BUILD SUCCEEDED **`. The vault's only warning is the existing
  `kSecUseAuthenticationUIFail` deprecation. The app target itself was not
  built.

The generated `ios/` and `android/` folders and the build output were
deleted afterwards.

## Not verified

- No simulator, emulator or device was run (another agent is doing device
  QA). The sheets, announcements, the real module flag across threads, and
  the timing of a cancel against a large backup are untested at runtime.
- Physical devices: not run.

## Deferred

- After a lock the hub remounts with "A restore started earlier is still
  running"; the restore sheet is gone, so a restore from before the lock
  cannot be cancelled from the new screen. Its outcome is still posted.
- Restore again after a partial reuses the same picked file and passphrase.
  If the lock sweep removed the picker's copy in between, the sheet is gone
  anyway.
- Liquid Glass sheets, and i18n of these strings through a real table, stay
  with steps 9 and F16/F17.

## Native QA checklist

1. One restore entry: Settings has a Backup row and no restore row; the hub
   has exactly one "Restore from a backup…"; Delete everything › Create a
   backup first opens the hub.
2. Cancel on both platforms, each with a large (hundreds of MiB) backup:
   during the KDF (immediately after Restore and replace vault), early in
   Checking, at the last Checking entry. Each: "Restore cancelled. Nothing
   was changed.", same document list and hashes, empty `restore-staging`,
   no `backup/restore`, Restore usable again.
3. Cancel pressed just before the first Restoring event: either cancelled
   as above or the sheet swaps to "This can't be stopped." with Cancel gone
   and the restore completes. Never "Nothing was changed" after the swap.
4. Restoring: brass callout announced (VoiceOver and TalkBack), no
   controls, sheet not dismissable, back gesture ignored.
5. Every outcome sentence and button from the table above, on both
   platforms, including the picker toast for a non-backup file and silence
   for a cancelled picker.
6. Android: let the Keystore window lapse mid-restore and cancel the prompt
   before and after the wipe (pre-wipe sentence vs. partial).
7. Create: Arabic passphrase, weak but valid passphrase allowed, busy sheet
   not dismissable, share sheet, "Last created on this phone" updates; lock
   during the share leaves the date unchanged.
8. Lock during Checking and during Restoring: the restore finishes behind
   the lock and its outcome is shown after unlock.

## Review fixes (CHANGES_REQUIRED, one Medium)

- **Medium, key probe after the first Restoring event.** On Android the
  device key was first used inside the restore handler, after the `import 1/N`
  event, so a Keystore window that lapsed during a long Checking pass failed
  with the vault intact but after JS had latched `wiped`, and was shown as
  partial. `importBackup` now calls `probeKey` in the preflight hook, after
  `preflightRestore` and before the last cancel check and any Restoring event;
  the probe in the handler stays as a backstop. iOS holds the device key in
  memory from the start of `importBackup` (no window that lapses), so it has
  no probe to move. A pre-wipe `KEY_INVALIDATED` now ends with "Nothing was
  changed." like `KEY_LOCKED`. Tests: the Kotlin harness gains a row that a
  preflight refusal ends before any Restoring event and a source row that the
  module probes in the preflight (failed before, passes after); Jest checks
  both key codes from the probe show the unchanged sentence with Restore
  enabled and no partial title.
- **Low, "Stopped at entry".** `stoppedAt` is now `{ entry, total }`, the
  entry after the last finished one, numbered like the progress (the check
  entry is 1), capped at the total.
- **Low, G11 test.** `restore-entry.test.tsx` also fails when any route other
  than the hub mounts `RestoreSheet`.
- Android `:expo-vault:compileDebugKotlin` rebuilt after the fix (no other
  build running, 61% memory free): `BUILD SUCCESSFUL`; generated `android/`
  deleted. iOS was not recompiled (no Swift change).

## Re-review follow-up: erase and the key sentences

Delete everything shows `describeBackupError`, so a `KEY_LOCKED` or
`KEY_INVALIDATED` there says "nothing was changed". That holds:
`deleteDocumentStore` uses the device key only to read the index name, before
closing and deleting anything; a locked key rejects there, and an invalidated
key falls back to the default name and the erase finishes. Index file, entry
and vault deletes never use the key, and entry delete failures are swallowed.
Two tests in `src/data/__tests__/database.test.ts` pin this: no keyed vault
call after the first removal, and an erase that finishes when the name read
finds the key invalidated. No erase sentence was changed.
