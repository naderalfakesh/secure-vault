# Hardening and plaintext residue verification

> Verified: 2026-10-19 to 2026-10-21 (partial, see "Not verified")
>
> Scope: everything merged after the native hardening integration note:
> export staging, the share sheet lock gate, the single backup operation,
> the shared credential prompt, the index swap waits, the memory-only image
> cache, the Xcode 27.1 build, the database key that fails closed, the PIN
> lockout across relaunches, the picker copies, restore staging, the restored
> index name and erase gate, the import residues, the index close, and the
> link-safe sweeps

Every native run below used debug builds on an Android 16 (API 36) arm64
emulator and an iOS 27 simulator, built with Xcode 27.1 from the commit
named in each section, over synthetic documents and fixtures. Nothing here
was run on a physical device. A result is listed as passed only when a run
at that commit showed it; everything else is listed under "Not verified".

## Changes

| Change                                                                                                                                                       | Commits                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Export plaintext staged one entry at a time in the cache's own `backup-staging` folder, with a path guard and a typed error when cleanup fails               | `1c721d3` to `6d8fa2c` |
| A share sheet or backup export opens only for the unlocked session that asked for it; finished containers and picked backups are swept at lock and launch    | `70dc496`, `0010dd3`   |
| One export, restore, or erase at a time, also across a lock and remount                                                                                      | `bfdbea1`, `0d111b1`   |
| One open credential prompt, shared by key recovery and PIN unlock; a cancelled prompt is not a wrong PIN                                                     | `f898de3`, `107c6c5`   |
| Index opens wait for a restore's file swap, and a swap waits for an open already under way                                                                   | `e39695d`, `76e6d89`   |
| Decrypted images kept in the image library's memory cache only; its caches cleared at lock and launch                                                        | `74e98f9`              |
| Expo modules built from source and the ExpoModulesJSI interface strip backported for Xcode 27.1                                                              | `4501838`              |
| The stored database key is never replaced when it cannot be read; typed errors instead                                                                       | `6c42738` to `385e5e0` |
| The PIN lockout is read at launch, capped, and judged one attempt at a time                                                                                  | `9d245cc` to `db3562c` |
| The document picker's plaintext copy is removed once saved or let go                                                                                         | `6794436` to `d3d486c` |
| Restore plaintext staged in the cache's own `restore-staging` folder and swept at launch; thumbnail scratch kept out of `tmp` and the vault folder           | `91d7f1d` to `5664458` |
| A restored index stays closed when its name cannot be read or is stale; opens are turned away while "Delete everything" runs                                 | `d5e13e4` to `4b79158` |
| Photo picker, camera, scanner, Inbox and preview copies removed; scratch from older builds swept at launch                                                   | `6dea69b` to `509d08d` |
| The index opens without finalizing statements on close, closes only after calls in flight settle, and an erase deletes nothing while a connection stays open | `8415675` to `384a57e` |
| Cache sweeps go through a vault module removal that never follows symbolic links                                                                             | `0f2374a` to `5872e2a` |

## Evidence

### Export staging, lock gate, backup slot, shared prompt, swap waits

Covered by earlier native runs on the commits that introduced them, and
again at `4501838` (2026-10-19):

- Export staging: the Android app exported and restored with at most one
  staged entry at `03bc52a`. On the iOS simulator a killed export was swept
  at the next launch at `03bc52a`; at `6d8fa2c` a real lock in the middle of
  an export of a 450 MiB vault left `backup-staging` empty, and a failed
  cleanup showed the plain sentence with no container left.
- Lock gate: a share started just before the vault locked was discarded
  without showing a share sheet, on Android at `0d111b1` and on iOS at
  `4501838`. On iOS the share copy was gone 194 ms after the late write, the
  lock screen stayed up, and the outcome was shown after unlock.
- Backup slot and shared prompt: with the restore held inside the slot and
  the key window lapsed, a PIN unlock opened one prompt that both the unlock
  and the restore's key recovery waited on. Answered twice and cancelled
  twice on Android at `4501838`: one prompt each time, the restore finished
  or was refused with `KEY_LOCKED`, the slot was released, and no wrong PIN
  was counted. Two concurrent prompt requests on iOS shared one answer.
- Swap waits: on Android at `4501838`, a Home call made during the swap
  waited for the new index, and an index open held in flight for 75 seconds
  made the restore's swap wait for it; the restored index was the only one
  left and survived a relaunch. The swap-wait repair alone passed three of
  three answered runs at `e39695d`.

### Memory-only image cache (iOS, `4501838`)

The image library's disk cache stayed empty through a photo and a
three-page PDF import, the document preview, page thumbnails, viewer paging
and the photo viewer. Stand-in files planted at the library's disk cache path
were removed at the first lock and, separately, at a cold launch before any
unlock. Display quality after unlock was unchanged. The legacy files were
planted by hand, not written by an older binary.

### Xcode 27.1 build (`4501838`)

A clean prebuild and `pod install` patched the ExpoModulesJSI script once and
left it alone on a second run. The iOS build succeeded on Xcode 27.1 and the
four JSI interface files carry no stripped declarations. Android
`assembleDebug` succeeded and the APK packages `libcrypto.so`.

### Database key fails closed (`d3d486c`, 2026-10-20): passed, scoped

Both builds compiled with the native entry listing change. On both
platforms:

- A first-run key survived a relaunch.
- A corrupted key file showed a plain sentence, and the file was left as
  it was.
- A missing key next to a restored index stopped the open, and the index was
  not swept.
- A kill, a missing key, "Delete everything" and a new setup gave a working
  vault.
- An export and restore round trip through the service calls restored the
  same documents.

Android also covered two cases. An install over a vault made at `4501838`
kept its key unchanged. A lapsed key window with a cancelled prompt kept the
key, and "Try again" recovered.

### PIN lockout across relaunches (`d3d486c`): passed

On Android:

- A pause survived a force-stop with the same end time, and the correct PIN
  was refused during it.
- The count continued after the pause and escalated to a 60-second pause.
- A cancelled prompt was not counted.
- A stored lockout with five failures and an end time of 10^15 was capped to
  30 seconds, and the cap was written back.
- With the clock set back, the pause was 30 seconds and ended on time.
- A value that is not JSON gave one 30-second pause, then four attempts left.
- A fast relaunch race never reset the count.

iOS passed the same cases, except the two listed under "Not verified". A
Face ID match also reset the lockout.

### Picker copies (`d3d486c`): passed

On both platforms the `DocumentPicker` folder was empty after each of these:
saving a PDF, saving a PNG, going back, closing the screen, cancelling, a
lock on the details form, and a kill followed by a relaunch. A planted
control file was removed at lock, decoy files elsewhere were kept, and the
test markers never turned up anywhere else. The system's own copy in the
iOS `tmp/com.naderalfakesh.securevault-Inbox` folder is a separate finding.
The import residue change removes it (`7891f1d`), verified below.

### Restore staging (`5664458`, 2026-10-20): passed

All ten cases passed on both platforms.

- Restore scratch and plaintext only ever landed in `restore-staging`. It
  held at most two files, and nothing landed in `tmp` or the cache root.
- A kill in the middle of an import served as a positive control. The
  folder held the decrypted `_database_key` on iOS and a partial plaintext on
  Android, and both were swept at the relaunch, before unlock.
- A lock during a restore let it finish. The folder was removed, and the
  outcome was shown after unlock.
- A wrong passphrase and a damaged backup gave typed errors.
- Saving a thumbnail left no file in `tmp` and no `vault*.tmp` file.
- Six staging path guards refused their inputs.
- Every document hash matched after the restores.
- On iOS, a "Delete everything" followed by setup worked.

The run found two Android issues outside this change:

- After a long session, "Delete everything" crashed once in expo-sqlite with
  a double free while closing the index, and the retry worked. The index
  close change addresses it.
- The JavaScript sweep followed a staging folder that had been replaced by a
  symbolic link. The link-safe sweeps address it.

### Restored index name, erase gate, and import residues (`509d08d`, 2026-10-20)

The import residues passed on both platforms. The Inbox copy was gone before
saving and the picker copy after it. The photo picker, the Android scanner,
the PDF previews, the lock and launch sweeps, and the sweep of files left by
earlier builds all removed what they should, and every control file, vault
entry, and index file was left unchanged. A save that outlived its screen
still finished and removed its copy.

The restored index name and erase gate passed their own cases on both
platforms: an unreadable or deleted name kept the restored index closed with
its contents unchanged, an open during "Delete everything" was turned away,
a refused key prompt showed its own sentence, and an unfinished erase could
be retried. One case failed on both platforms: right after "Delete
everything", the app opened the index again and created a new key and an
empty index before setup. That was already happening before this change, and
the change listed below as pending fixes it.

The run also found that closing the index after any search index write
crashed the app (every time on Android, two of three on iOS), and that
connections left open by restores let an erased index come back after setup.
The next run covers both.

### Index close and link-safe sweeps (`5872e2a`, 2026-10-21): passed

- After a search index write, closing the index or running "Delete
  everything" no longer crashed: none in 54 runs on Android and 17 on iOS.
  Searches running during an erase, a restore followed by a search and an
  erase, and three long sessions of restores, locks, exports, and new
  documents all passed.
- After several restores, "Delete everything", and setup in one session, no
  handle to an erased index stayed open, the document list was empty, and a
  new document was still there after a relaunch.
- Staging and cache folders replaced by symbolic links were unlinked at
  launch and lock without touching what they pointed to, on both platforms.
  An export and a restore with a staging folder replaced that way still
  worked, and normal exports and restores were unchanged.

Two small gaps are left. An Android export writes its encrypted backup and
index copy through a `backup` folder replaced by a link before failing with a
typed error, and a restore in the same situation fails closed with a raw
error. Both need write access as the app itself.

## Not verified

- The index staying closed between "Delete everything" and setup: pending.
- Database key, on iOS: an install over an existing vault (there was no
  vault made before this commit).
- Database key, on both platforms: a key the system invalidates after a new
  fingerprint, the Keychain refusing an unsigned build, and a listing that
  returns nothing.
- PIN lockout, on iOS: a cancelled Keychain prompt, and the clock set back.
  The cap case exercises the same code as the clock change.
- The memory-only image cache on Android.
- Physical devices, for every change above.
- `npm run validate` fails only on Expo Doctor, which asks for newer Expo
  patch releases (`expo` 57.0.30, `expo-router` 57.0.28) than the
  `~57.0.29` line pinned here.
