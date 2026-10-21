# Final security fixes verification

> Verified: 2026-10-22 (partial: Jest, a Swift typecheck of the backup
> container and an Android module compile only; no simulator, emulator or
> device, see "Not verified")
>
> Scope: H1, M1 and M2 and two Lows from the final native QA at `48673b1`
> (`fix/polish-round2`). Branch `fix/final-security`. No backup format,
> crypto or key change.

| Item                                                | Outcome | Commit    |
| --------------------------------------------------- | ------- | --------- |
| H1 Android auto-lock bypass after the share chooser | Fixed   | `5e3e3e8` |
| M1 a lost PIN or lockout record read as absent      | Fixed   | `5bbcb94` |
| M2 the picked backup is purgeable                   | Fixed   | `5b39568` |
| Low `cancelRestore()` true after the cancel point   | Fixed   | `f2d1929` |
| Low backup file name used the UTC date              | Fixed   | `5a62bc8` |

**H1.** Android delivers the chooser's Back or pick before the app is active
again, and its paused JavaScript timers never fired, so the pause ended
"away" and its time was excused by the return grace. `withoutAutoLock` now
judges the pause when it ends: if the app has been away under it for longer
than its `maxAwayMs`, the whole trip since the app left is judged against
auto-lock at once (it locks with Immediately), and the trip's start is kept,
so the return judges the total time away again with no grace. A pause that
ends within its bound keeps the old behaviour, so a picker result that lands
just before the return does not lock. Leaving the session clears the timed
trip. The rule sits in `withoutAutoLock`, so pickers, the camera, the scanner,
`stepUp` and both share sheets use it.

**M1.** Plain marker files `Documents|files/securevault-session/pin` and
`/lockout` are written after their record and again whenever the record is
read, which also marks records from earlier builds. A missing PIN record with
its marker reads as `unreadable` (`lost`): with the device key present the
session is `unavailable`; without a key (a device backup restored the
folder, not the Keychain or Keystore) it is setup as before. A missing lockout
record with its marker is the 30-second fail-safe pause, written back.
`clear()` removes the markers before the records, and if a marker cannot be
removed it deletes no record, so a marker never outlives its record. The way
out: on a lost PIN the unavailable screen also offers "Set a new PIN", which
asks for the device key's own prompt (the same door as the lock screen's
device unlock) and then opens setup, which keeps the key and documents. Same
logic on iOS.

**M2.** `backupService.keepPickedFile` moves the picker's copy from
`cache/DocumentPicker` to `Documents|files/restore-source/picked.svbackup`
before the header is read. The move is a rename on the same volume, so it
needs no space, and nothing stays in the cache. A failed move removes the
cache copy and the folder and ends with `BACKUP_RESTORE_STAGING_INVALID`. The
lock and launch sweep and `discardPickedFile` remove the folder, except while
a restore reads it, and a second pick is refused then. The vault module's
`removeTreeNoFollow` accepts that exact folder (never an entry below or
beside it) on both platforms, with the same no-follow removal. Disk
preflight: the source now sits in files, not in the cache that is taken out
of the allocatable figure, so it counts as used space and never as room. The
code needed no change.

**Lows.** The native modules keep one atomic cancel state. The restore's last
cancel check, after the preflight, both refuses an earlier request and marks
the point passed, and `cancelRestore()` returns false from then on. The
service passes that answer on, so a true answer is always honoured even
though the progress events reach JavaScript late. The file name uses the
device's local calendar date.

## Tests (Jest, 718 passing)

- H1, `SessionProvider.test.tsx`: chooser past its bound then Back; past its
  bound then a pick (locked before the return); within its bound with
  auto-lock 5 minutes and Immediately (stays open); past the bound but within
  auto-lock, then a return after auto-lock (locks on the total); Home (locks);
  a picker past 10 minutes; the next session starts untimed. Four fail
  without the fix.
- M1, `SessionProvider.unavailable.test.tsx` and `vault-unavailable.test.tsx`:
  setup writes both markers; a corrupted PIN with a marker is unavailable
  (no `createVault`); a PIN lost between launch and setup stops setup; a first
  run with no marker is setup; a marker without a key is setup; an old
  record gets its marker; erase clears the markers and the relaunch is a
  first run; a marker that cannot be removed keeps every record; a corrupted
  lockout is the fail-safe pause written back; "Set a new PIN" behind the
  device prompt keeps the key and entries; a cancelled prompt stays
  unavailable; an unreadable store that lost nothing offers no reset; the UI
  shows the sentence and the button.
- M2, `BackupService.test.ts` and `backup-hub.test.tsx`: the source moves out
  of the cache, and inspect and import read the kept path; an earlier pick is
  replaced; the folder is swept at lock and launch and left to a running
  restore; a pick during a restore is refused; discard removes it; the user's
  own file stays where it is; a failed move cleans up with a typed error; a
  planted link is unlinked and its target kept; the module never removes an
  entry below the folder or a vault entry beside it.
- Lows: a module that has passed its cancel point gets false; the mock
  module refuses after its point and opens again after the restore; the
  local date wins over the UTC one.

## Commands

- `npm run validate`: exit 0 (prettier, eslint, tsc, 718 Jest tests,
  expo-doctor 20/20).
- `xcrun swiftc -typecheck` for `BackupContainer.swift` with
  `VaultCrypto.swift` (iOS simulator SDK): clean. `swiftc -parse` for
  `ExpoVaultModule.swift`: clean. A full iOS build was not run.
- `expo prebuild -p android` then `./gradlew :expo-vault:compileDebugKotlin
--max-workers=4` (JDK 17): exit 0. The generated `android/` and the build
  outputs were deleted afterwards.

## Not verified

No simulator, emulator or device run. Targeted native re-QA:

1. Android, auto-lock Immediately: chooser up for more than 2 minutes, then
   Back, then a pick; both must open the lock screen. Then within 2 minutes
   with auto-lock 1 minute, which must stay unlocked. Home from the chooser.
2. Android, auto-lock 5 minutes: chooser for 3 minutes, Back, return; stays
   open. A trip of 6 minutes in total locks.
3. Android: tamper `SecureStore.xml` (PIN entry) and relaunch. It must show
   Vault unavailable with "Set a new PIN", not "Add a PIN". The device prompt
   then opens setup and the documents are intact. Tamper the lockout entry:
   a 30-second pause.
4. Both: Delete everything, relaunch, and setup (no unavailable screen).
   Upgrade over a pre-fix install: the lock screen as before, and the marker
   is written.
5. Android low storage: pick a large backup and hold the restore sheet open
   under storage pressure. `files/restore-source/picked.svbackup` survives,
   nothing is left in `cache/DocumentPicker`, and the restore works. Lock with
   the sheet open: the folder is gone.
6. iOS: the same pick, plus a full signed build (Swift `removeTreeNoFollow`
   with `exact`, the `cancelRestore` `Bool` return).
7. Cancel right at "Checking N of N" on both platforms: either
   BACKUP_CANCELLED with the vault unchanged, or no "Cancelling" state and
   the restore completes.
8. A backup made just after local midnight carries the local date.
