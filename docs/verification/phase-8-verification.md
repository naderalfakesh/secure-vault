# Phase 8 verification

> Verified: 2026-09-07
>
> Scope: passphrase-protected backup file, restore with validation and
> progress, the written key hierarchy

## Outcome

Export writes every vault entry and the encrypted SQLite index into one
`.svbackup` file protected by a passphrase-derived key, hands it to the
system share sheet, and removes the copy afterwards. Restore inspects the
file first, asks for the passphrase, rejects a wrong one before touching
anything, and replaces the vault with the file's contents. The format is the
same on both platforms: a backup made on the iPhone simulator restored on the
Android emulator. [ADR 0007](../adr/0007-passphrase-protected-backup-container.md)
records the container and [SECURITY.md](../SECURITY.md) the key hierarchy.

## Native run evidence

iOS, iPhone 17 Pro simulator, development client rebuilt with the backup
container:

1. Export. Settings, Export vault opens a sheet with two passphrase fields
   (`docs/images/export-sheet-ios.png`). With the passphrase entered twice,
   Create backup writes the file in well under a second for a vault of five
   documents (three photos, a passport, a two-page PDF), and the share sheet
   shows "SecureVault backup 2026-09-07", 10.8 MB, with Save to Files
   (`docs/images/backup-share-ios.png`). While the sheet is up the file
   exists in `Library/Caches/backup/`; after dismissing it the directory is
   empty and the toast reads "Backup of 15 entries (10.3 MB) shared"
   (`docs/images/backup-toast-ios.png`). The file starts with the `SVB1`
   magic and a 193-byte JSON header.
2. Delete everything. The vault is erased, the app returns to onboarding,
   and setup offers "Add a PIN to your vault" because the device key is
   kept. Home is empty afterwards.
3. Restore, wrong passphrase. Restore from backup opens the Files picker;
   the backup copied to On My iPhone shows up next to the lease PDF. The
   sheet reads "SecureVault backup 2026-09-07.svbackup: 15 entries, made
   2026-09-07" (`docs/images/restore-sheet-ios.png`). A wrong passphrase
   shows "That passphrase does not match this backup." inside the sheet
   (`docs/images/restore-wrong-passphrase-ios.png`) and the vault directory
   still holds only the two entries of the empty vault.
4. Restore, right passphrase. The vault directory holds sixteen entries, the
   index arrives as `securevault-<timestamp>.db` with the old file swept, and
   Home shows the five documents again with the passport's expiry in
   Expiring soon (`docs/images/restore-home-ios.png`). No crash report was
   written, and the app relaunches into the restored vault after the final
   native rebuild.

Android, Medium Phone emulator, API 36.1, fresh install, screenshots taken
with the privacy screen switched off:

1. Cross-platform restore. The backup made on the iPhone was pushed to
   Downloads and chosen through the system picker. The sheet reads the same
   header, "15 entries, made 2026-09-07". Restore shows "Restoring 0 of 1"
   for about nine seconds while PBKDF2 runs on the emulator, then
   "Restoring 12 of 16", and Home shows "5 documents" with the passport in
   Expiring soon. The vault directory holds the restored entries plus
   `_database_file`, and the index sits under a new timestamped name.
2. Export. With both fields filled (`docs/images/export-sheet-android.png`),
   submitting from the keyboard shows "Encrypting 0 of 1", then the file
   appears in the cache and the chooser opens with "Sharing 1 file,
   SecureVault backup 2026-09-07.svbackup" (`docs/images/backup-share-android.png`).
   Dismissing the chooser leaves the backup directory empty.
3. The lapsed Keystore window from Phase 7 was exercised for real: an
   export attempted minutes after unlocking raised `KEY_LOCKED`, the
   credential prompt appeared once, and the export continued after it.

## Defects found by the run

- Restoring on iOS crashed inside SQLite's FTS5 teardown when the open index
  connection was closed right after the native import (`sqlite3Fts5IndexClose`
  in `closeDatabase`). The restore now installs the index under a fresh file
  name, points the vault at it, and abandons the old connection rather than
  closing it; stale files are swept on the next open (commit a5b2e78).
- On Android the vault shares the app's files directory with other
  libraries' files (the development client's cached bundle, a profile
  marker). Listing, erasing, and backing up "every entry" would have
  included them. Both modules now treat only the vault's own names as
  entries: `file_`, `thumb_`, `page_`, and the underscore-prefixed metadata
  (commit b424ad5).
- Sheets did not move for the software keyboard, so on Android the second
  passphrase field and the button sat behind it. The sheet now pads itself by
  the keyboard height (commit 3293466).
- The event subscription helper was wrapped by the key-recovery proxy and
  returned a promise instead of a subscription, so the first export never
  finished its cleanup; the proxy now leaves synchronous helpers alone
  (commit f806daa).
- Presenting the share sheet while the export sheet's modal was still
  dismissing left iOS with neither on screen; the share now waits for the
  sheet to close (commit 30e9525).
- Toasts sit behind an open sheet, so backup errors are shown inside the
  sheet instead, and Enter submits the passphrase fields.

A testing note: typing into a development build on Android through `adb`
fires the dev menu's keyboard shortcuts (two quick `r` presses reload, which
left the bridgeless runtime blank until a process restart). Test passphrases
were chosen to avoid those keys; production builds have no such shortcuts.

## Quality gate

`npm run validate` passes: Prettier, ESLint, TypeScript 6 strict, Jest
(14 suites, 58 tests), Expo Doctor. New tests cover the passphrase policy,
error wording, a create-restore round trip through the mock container with
progress events, and a wrong passphrase leaving the vault untouched.

## Deferred

- A backup made on Android restored on iOS; the reverse direction is the one
  exercised here.
- Argon2 for the KDF has no system implementation on either platform;
  PBKDF2-HMAC-SHA256 at 600 000 iterations stays.
