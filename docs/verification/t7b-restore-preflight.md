# Restore preflight verification (SV-T7b)

> Verified: 2026-10-21 (partial: host harnesses and native builds only; native
> runtime QA pending, see "Not verified")
>
> Scope: the D21 remainder. Header settings checked against the exporter set,
> entry structure rules, and a memory and disk check, all before the vault is
> cleared. No format, key or exporter change.

## What was already in place

- Declared lengths bounded by the bytes left in the file, typed structural
  errors, and both passes reading through one bounded reader (T7a).
- A backup without a `database` extra or a `_database_key` string refused
  before the key is derived (`292506f`).
- On Android an allocation the device refuses during a restore or inspect
  ends in `BACKUP_RESOURCE` before the wipe and `BACKUP_PARTIAL` after it
  (`53b42b3`). An empty or undecodable salt is `BACKUP_INVALID` on both
  platforms (`2e4e889`). The device key is used once more right before the
  wipe on Android (`b91a72b`). A failure after the native restore is
  `BACKUP_INDEX` (`69c5ca9`). The `VaultCrypto` comments already say "interior
  chunks".

## Changes

- **Header policy, before the KDF, same rules and order on both platforms.**
  The version must be an integer: above 1 is `BACKUP_UNSUPPORTED`, below 1
  `BACKUP_INVALID`. The version is read first, so a version-2 header of any
  shape is named as such. Every field the exporter writes (`app`, `created`,
  `kdf.name`, `kdf.iterations`, `kdf.salt`, `cipher`, `entries`) must be
  present with its JSON type. Android no longer defaults a missing
  `iterations` to 600 000 or a missing `version` to 0. Iterations must be 1 to
  2^31−1 and entries 3 to 2^31−1, otherwise `BACKUP_INVALID`. After that, the
  KDF name, the cipher and the iteration count must be `pbkdf2-hmac-sha256`,
  `aes-256-gcm` and a value in `{600000}`, otherwise `BACKUP_UNSUPPORTED`.
  `inspectBackup` applies the same rules, and iOS now maps its refusals to the
  same codes as Android.
- **JSON integers read alike.** Kotlin accepts a whole JSON number of any
  class org.json produces (`600000`, `600000.0`, `6e5`), as Swift's
  `JSONDecoder` does. The harness found the difference: Android refused
  `600000.0` and iOS accepted it.
- **Entry structure, before the KDF.** The first entry is `_check`/`c`, and
  no other entry has kind `c`. Kinds are limited to `c`, `s`, `f` and `x`. No
  two non-check entries may share a key. There is exactly one `x` `database`
  and at least one `s` `_database_key`. The file must end right after the
  last declared entry. Anything else is `BACKUP_INVALID`. `isRestoreKeyAllowed`
  now refuses an unknown kind instead of letting it through.
- **Memory before each header and meta read (iOS).** The declared length × 2
  is compared with `os_proc_available_memory()`. A figure of 0 (no limit
  reported) is not a refusal. Android keeps its typed allocation failure.
- **Restore preflight, after the verify pass and before the wipe.** A new
  `preflight` hook in `BackupContainer.read` gets the pre-pass layout. The
  largest `s` plaintext is bounded by its payload length − 8. Android trial
  allocates 4 arrays of that size, and refuses a size above `Int.MAX_VALUE − 8`
  by type. iOS compares 3 × that size with the OS figure. Disk need is the sum
  of every non-check payload plus 2 × the largest payload. That need is
  compared with the free space (`StatFs.availableBytes`, or iOS
  important-usage capacity) plus the bytes of the vault entries the wipe will
  delete. A memory refusal is `BACKUP_RESOURCE` and a disk refusal is the new
  `BACKUP_NO_SPACE`. No fixed cap or margin is used anywhere.

The memory multipliers (4 on Android, 3 on iOS) are read from the code paths
and are provisional until the S-s fixtures measure them.

## Sentences

| Code                 | Settings sentence                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `BACKUP_UNSUPPORTED` | This backup uses settings this version of the app doesn't support. Nothing was changed.                                   |
| `BACKUP_INVALID`     | This file is not a SecureVault backup, or it is damaged. Nothing was changed.                                             |
| `BACKUP_RESOURCE`    | This device doesn't have enough memory to restore this backup. Nothing was changed.                                       |
| `BACKUP_NO_SPACE`    | This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again. |

`BACKUP_PARTIAL` and `BACKUP_INDEX` never say that nothing changed.

## Evidence

- `npm run validate` exits 0 at the final tree (prettier, eslint, tsc, 283
  Jest tests, expo-doctor 20/20). Three runs in a row passed after the change
  PIN test was made to wait for its outcome: that test asserted after one
  `act` flush, while noble's `pbkdf2Async` yields between slices.
- New Jest tests cover every new sentence, the plain-text path, and each
  pre-wipe refusal passing through `restoreBackup` unchanged. Each refusal
  keeps the vault keys and the `_database_key`, reloads no index, removes the
  restore staging folder and frees the operation slot. The tests also cover
  inspect refusals, the sentence in the restore sheet with no native text,
  and the toast for an unsupported header with no sheet opened.
- Host harnesses compiled the worktree's own `BackupContainer` and
  `VaultCrypto` sources unmodified. The Kotlin ones ran on the JVM with
  openjdk 17. The Swift ones ran as a Mac Catalyst binary, with no simulator.
  The module hooks and error mapping are mirrored. Results:
  - 4 golden app exports (G-and `12868aed`, G-ios `54758b37`, G-and-2
    `7082b0da`, G-ios-2 `39942fd8`) restore on both, with identical
    plaintext digests across platforms (28 entries).
  - 46 hostile byte mutations of G-and gave the expected code on both, with
    0 parity differences. The header-policy and structure rows end before
    the verify pass, at 0 to 1 ms against about 100 to 570 ms for a golden
    KDF plus restore. The rows cover iterations 600001, 1, 1 200 000 and
    2^31−1 (`BACKUP_UNSUPPORTED`, the old Android hang); 2^31, 4e9 (the old iOS
    hang), string, missing and fractional (`BACKUP_INVALID`); version 0, −1,
    missing and string (`BACKUP_INVALID`); version 2 in two shapes; and an
    altered KDF name or cipher (`BACKUP_UNSUPPORTED`). They also cover missing
    fields; 0 or 2 entries; a moved, removed, second or renamed check entry; a
    `q` kind; 1 or 16 trailing bytes; a short count; and absent, duplicate or
    shadowed `database`, absent `_database_key`, and duplicate `s` and `f` keys
    (`BACKUP_INVALID`).
  - Disk rows: no space, one byte short, and a split one byte short end in
    `BACKUP_NO_SPACE` with nothing handled. Exact space, space freed only by
    the old vault, and an even split restore.
  - Memory rows: a 24 MiB `s` entry is `BACKUP_RESOURCE` with nothing handled
    at a 64 MiB heap (Android) or a 50 MB OS figure (iOS). It restores at
    160 MiB, at 100 MB and with no figure. Headers and metas padded with
    32 MiB of whitespace are `BACKUP_RESOURCE` before the KDF at a 40 MiB heap
    or a 16 MiB figure, and restore otherwise, because no cap applies.
  - The pre-pass rules ran over all 25 `.svbackup` files recorded in earlier
    QA export folders. 24 pass on both platforms. The one refusal is an
    earlier QA export of a QA-seeded vault with no index entries, which
    `292506f` already refused.
  - The 32 T1/T2 and 24 T7a fixtures give the same codes on both readers.
    The T1/T2 control still restores. T7a's 400 MiB `hdr-len-large` depends
    on memory alone: `BACKUP_RESOURCE` at a 1 GiB heap or a 100 MB figure,
    and it restores at 4 GiB or 2 GB.
- Native builds from the spaced SSD path. `npx expo prebuild --clean`
  passed. Android `assembleDebug` (openjdk 17, `--max-workers=4`) compiled
  `:expo-vault:compileDebugKotlin` without warnings. The first run failed only
  in `:app:packageDebug` (`IncrementalSplitterRunnable`), and the rerun was
  `BUILD SUCCESSFUL`. The APK carries `libcrypto.so` for all four ABIs. The
  iOS Debug simulator build ended in `** BUILD SUCCEEDED **`, and the vault's
  only warning is the existing `kSecUseAuthenticationUIFail` deprecation.

Harness sources, fixture generator, `INDEX.tsv`, `SHA256SUMS` and logs are
kept with the local QA evidence, outside the repository. `harness/run_all.sh`
there rebuilds and reruns everything.

## Not verified

- No simulator, emulator or device was booted. The restore sheet, the real
  module error mapping, `StatFs` and the iOS capacity key, ART's trial
  allocation, and `os_proc_available_memory` in an app process are untested
  at runtime. The harness mirrors the module code but does not run it.
- The `k` multipliers are not measured.
- Physical devices: not run.
- Residuals: an index that decrypts but does not open (T7c, `BACKUP_INDEX`
  after the wipe); memory taken or disk filled during the restore pass
  (`BACKUP_PARTIAL` on Android, a process kill on iOS); and a backup from a
  build outside git history with other settings, which is refused (D22).

## Native QA plan

1. Hostile set H on both platforms through the real restore sheet, from the
   file picker: every row ends in its `INDEX.tsv` code and sentence. Check
   that the vault folder, the index and the Android IV store are
   byte-identical, that no `restore-staging` or `backup/restore` residue is
   left, and that the header and structure rows refuse in under a second.
2. Positive controls: G-and, G-ios, G-and-2 and G-ios-2, restored on both
   platforms in both directions. Each ends in "Vault restored: N entries"
   with matching plaintext digests and a byte-identical index. Repeat with a
   fresh export from this build on each platform.
3. Memory: S-s-8 and S-s-32 seeded as legacy `s` entries, to measure `k`.
   S-s-32 on a small-heap emulator (reduced `dalvik.vm.heapgrowthlimit`) must
   end in `BACKUP_RESOURCE` and never in `BACKUP_PARTIAL`. Record
   `os_proc_available_memory()` in the iOS app.
4. Disk: fill the emulator's `/data` until free space plus the vault is below
   the need (G-ios-2 needs about 9.3 MB), then expect `BACKUP_NO_SPACE` with
   nothing changed. On iOS, try a small simulator data volume if one can be
   set up.
