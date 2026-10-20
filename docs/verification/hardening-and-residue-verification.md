# Hardening and plaintext residue verification

> Verified: 2026-10-19 to 2026-10-20 (partial, see "Not verified")
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
at that commit showed it; everything else is listed as open.

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

### Database key fails closed (`d3d486c`, 2026-10-20)

On both platforms: a corrupted `_database_key` stopped the open with "The
document index key could not be read. Nothing was changed." and the value was
left as it was; a deleted key with an index present stopped with the
missing-key sentence and no new key was written; a planted index file with no
key did the same; setup after "Delete everything" wrote a fresh key that
survived a relaunch; and a backup round trip restored the same documents.
Android also showed an existing vault unlocking after the upgrade with its
key unchanged, and a cancelled prompt during the open leaving key and index
untouched, with the next try opening the vault. That cancelled-prompt error
was shown as the platform's own text, not one of the typed sentences.

### PIN lockout across relaunches (`d3d486c`)

On both platforms five wrong PINs started a pause that survived a relaunch,
the correct PIN was refused during it, and the count continued after it. A
planted pause far in the future was capped, a store that is not JSON was
treated as a short pause, and failures carried across relaunches. Android
also covered a second, longer pause, the clock set back a day, a cancelled
prompt that did not count, and 475 rapid taps that stopped at exactly five
failures.

### Picker copies (`d3d486c`)

On Android the `DocumentPicker` copy was gone after saving, going back,
closing, a lock in the background, a kill and relaunch, and an erase; decoy
files were left alone. On iOS the `DocumentPicker` copy was removed, but the
system's own copy in `tmp/com.naderalfakesh.securevault-Inbox` stayed in
every flow. The import residue change (`7891f1d`) removes that copy; it has
not been run yet.

### Restore staging (`5664458`, 2026-10-20)

On both platforms a restore watched while it ran put plaintext only in
`restore-staging`, never in `tmp`, and every hash matched afterwards. A
restore killed mid-entry left staged files that the next launch removed
before unlock. A wrong passphrase and a damaged file were refused with the
vault unchanged and staging empty, and five bad staging paths and a linked
staging folder were refused natively. A lock during a restore left staging
in place until the restore ended; the notice after unlock was seen on
Android.

## Not verified

- Restore staging (`5664458`): on Android the first "Delete everything" of
  the run crashed the app inside expo-sqlite while closing the index (a
  double free in `sqlite3_close`), and the erase did not finish; a second
  erase did. The same run's Android link test left the link's target empty,
  which a link-following sweep would explain. The iOS thumbnail scratch file
  was not checked after a lock, the iOS erase case has only screenshots, and
  the launch sweep of older builds' scratch had no result on either
  platform.
- Restored index name and import residues (`509d08d`): the run was still in
  progress at the time of writing and iOS had not started. On Android so far,
  scratch from older builds was removed at launch with look-alike files left
  alone. An unreadable or deleted `_database_file` kept the index and created
  no default file, but Home showed an empty vault instead of the error
  sentence. An erase during an open crashed in the same expo-sqlite close.
  The picker and camera copies were not run. None of this is a result yet.
- The index close change (`8415675` to `384a57e`), meant to fix that crash,
  and the link-safe sweeps (`0f2374a` to `5872e2a`): not yet run on either
  platform.
- On iOS, at `d3d486c`: the upgrade over an existing vault, the cancelled
  prompt during the open, the clock set back, the cancelled prompt during
  PIN entry, and the rapid-tap race.
- The memory-only image cache on Android.
- Physical devices, for every change above.
- `npm run validate` fails only on Expo Doctor, which asks for newer Expo
  patch releases (`expo` 57.0.30, `expo-router` 57.0.28) than the
  `~57.0.29` line pinned here.
