# Polish round 2 verification

> Verified: 2026-10-21 (partial: Jest, host harnesses and an Android module
> compile only; no simulator, emulator or device, see "Not verified")
>
> Scope: the three Mediums and the Lows from the milestone 1 native QA at
> `27419d3`, plus L1, L2 and L3 from the SV-T7b review. Base `b07602c`
> (`feat/redesign-visuals`). No backup format, crypto or key change.

## Round 2

### Mediums

| Item                                                      | Outcome                                                | Commit    |
| --------------------------------------------------------- | ------------------------------------------------------ | --------- |
| M1 Android disk preflight trusted `StatFs`                | Fixed                                                  | `f81337c` |
| M2 ML Kit telemetry against "no analytics"                | Claims corrected; cannot be turned off; owner decision | `631b028` |
| M3 `content://` import through `fetch`                    | Fixed                                                  | `046dc6e` |
| T7b L1, two times the largest payload in free space alone | Fixed with M1                                          | `f81337c` |
| T7b L2, memory multipliers                                | Measured on the host, kept                             | `d844521` |
| T7b L3, index copy in the disk need                       | Fixed with M1                                          | `f81337c` |

**M1.** On API 26 and later the free figure is `File.usableSpace`, capped
by `StorageManager.getAllocatableBytes(getUuidForPath(filesDir))` minus the
bytes in SecureVault's own cache folder. The allocatable figure leaves out
the system's low-storage reserve that `StatFs` and `usableSpace` count, so a
restore that would push the device into the reserve is refused. It also
counts every app's clearable cache, ours included, and ours holds the picked
backup (`cache/DocumentPicker`) and the staging folders, so our cache is
taken out of it and nothing is cleared. Review round 1 removed the earlier
`allocateBytes` call: it could delete the picked backup between the two
passes. If the figure cannot be read (`IOException` or anything else), and
below API 26, the usable space alone is used. minSdk is 24 (React Native
0.88), so that fallback is reachable. iOS already used
`volumeAvailableCapacityForImportantUsage`. Both platforms also refuse when
the first restored entry's payload copy and plaintext (twice its payload)
are more than the free space alone (L1). Those two files are written before
the old vault is removed, and review round 1 narrowed the bound from the
largest entry to that first one. The `database` extra is counted a second
time in the need (L3): the index is moved into the SQLite folder after the
native restore, and its first open writes a WAL while the old index is still
there. The T7b semantics are otherwise unchanged: `BACKUP_NO_SPACE`, nothing
changed, and no fixed margin.

**M2.** `MLKitCommon` (pod 13.0.0, under `GoogleMLKit` 8.0.0 from
`@react-native-ml-kit/text-recognition` 2.0.0) embeds its own Clearcut
uploader (`MLKITx_CCTClearcutUploader`, with Phenotype configuration). Its
privacy manifest declares device ID, performance, product interaction,
diagnostic and other data, collected for analytics, not linked to the user
and not used for tracking. Google's ML Kit terms say ML Kit sends performance
and usage metrics but not its input or output. The data disclosure pages list
the metrics and name no opt-out. Android uses the bundled
`com.google.mlkit:text-recognition` 16.0.1 and the Play services document
scanner, which runs outside the app. No Info.plist key, manifest flag or
Gradle exclusion turns these metrics off: the Firebase data-collection
switches do not apply, and the bundled and unbundled models log the same
way. Behaviour is therefore unchanged, and these places now say what is
true: the protection page fact, the processing sheet footer, the
`docs/SECURITY.md` threat model (with a new "Google ML Kit metrics" section),
and the README. Owner decision (review round 1): keep ML Kit on both
platforms and disclose it. The final wording, the same everywhere, says
that ML Kit reads text on the device (with the Play services scanner on
Android), that it sends Google usage and performance metrics that include a
per-installation identifier (so they are never called anonymous), that it
does not send images or the text it reads, and that this cannot be turned
off. `docs/SECURITY.md` lists the data categories from the privacy manifest
and Google's disclosure pages.

**M3.** Kept and fixed rather than removed. No picker hands over a
`content://` URI today, but the Android scanner's page URIs come from Google
Play services, whose scheme the app does not control.
`getLocalFilePath` now copies with expo-file-system's
`new File(uri).copy(tempFile)`, which reads through the content resolver.
The `temp_import_<n>` name is kept, and a copy that fails part way is still
removed. The 8 s fetch timeout went with `fetch`.

**L2.** A host process ran the module's `s` restore calls for a 24 MiB
plaintext (`l2-memory/` in the card's evidence folder). JVM (`readBytes` and
AES-GCM `doFinal`): it failed at a 70 MiB heap and passed at 80 MiB, about 3.3
copies including the VM baseline. Swift (`Data(contentsOf:)` and
`AES.GCM.seal(...).combined`): the footprint peaked at 2.03 copies. The
multipliers stay at 4 (Android) and 3 (iOS): the extra copy is headroom for
ART's Conscrypt and for a device, neither of which was measured.

### Lows

| Item                                          | Outcome                                                                               | Commit    |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | --------- |
| Lockout dots stay red, brand mark             | Dots are now empty and dimmed. The clock mark was already on this base (`64c02d2`)    | `a985a43` |
| "Delete 0"                                    | A plain disabled "Delete"                                                             | `1486728` |
| Snippets start mid-word                       | Trimmed to whole words at both ends, checked against the page text                    | `90cb832` |
| "Checking 0 of 1"                             | "Checking…" / "Restoring…" until the first entry is done                              | `24a70d3` |
| Empty `cache/backup` after a refusal          | Removed when the restore leaves it empty                                              | `c75409f` |
| Android picker silent on a full disk          | Skipped, see below                                                                    |           |
| Lock-while-sharing notice differs by platform | Already unified on this base: both platforms set the viewer banner (`b237178`)        |           |
| RTL date and tag chips                        | Date isolated; tag chips keep "# " first with the tag isolated                        | `2b11938` |
| Version without a build number                | `ios.buildNumber` "1" and `android.versionCode` 1 in `app.json`, shown as "1.0.0 (1)" | `4bfe2e1` |
| iOS fail-closed Try again                     | A connection whose setup failed and stayed open is closed before the next open        | `d532e71` |
| Raw path in a slow-save toast                 | A platform message that names a path or URI falls back to the plain sentence          | `2d9a027` |

Skipped:

- **Picker on a full disk.** The QA run (`D-and-nospace-2`) shows no toast and
  no sheet, so expo-document-picker resolved as cancelled. If its copy had
  failed, it would have rejected, and that path already shows a sentence. A
  cancel from a full DocumentsUI cannot be told apart from the user's own
  cancel without a device, and a free-space guess would misfire. Native QA
  should capture logcat for this case.
- The ones the brief named: unlock always lands on Library (design), undo
  copies during background (F8, known), blank Android Recents thumbnails
  (FLAG_SECURE, intended), the dev-only linking error and Tools bubble.
- AX5 truncation was not in the brief.

**iOS fail-closed: caveat.** The QA screenshot shows the stale-name error,
which is thrown before any connection opens. In JavaScript, every Try again
already re-runs the whole open. The fix covers the one state that does
survive a retry, a connection left open after its setup failed. The QA
case's real cause could not be reproduced without a simulator, so it is
listed for native QA.

## Review round 1

| Finding                                                           | Fix                                                                                                            | Commit    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| M1 `allocateBytes` could clear the picked backup in our own cache | No clearing. Free is `usableSpace` capped by allocatable minus our own cache (`BackupContainer.writableBytes`) | `ed56aa4` |
| L1 `getAllocatableBytes` exceptions                               | Caught; falls back to `usableSpace`                                                                            | `ed56aa4` |
| L2 low-storage reserve                                            | Documented in `docs/SECURITY.md` and above                                                                     | `ed56aa4` |
| L3 pre-wipe bound overstated                                      | Twice the first restored entry's payload, on both platforms                                                    | `3f2340e` |
| L4 stalled content provider                                       | 8 s timeout (`IMPORT_COPY_TIMEOUT`); a copy that settles later is removed then                                 | `2f43c2b` |
| L5 ML Kit wording                                                 | One disclosure everywhere, never "anonymous" (owner keeps ML Kit)                                              | `5148344` |

The harness rerun (`t_131b87be/logs-polish2-r1/`) gives 0 FAIL on the JVM
and Catalyst, with 0 parity differences. In the disk rows the pre-wipe bound
for G-and is now 208 bytes, against 924 190 before. A new
`writable-excludes-own-cache` unit row passes. The Android
`:expo-vault:compileDebugKotlin` passed again; the build output was removed.

## Evidence

- `npm run validate` exits 0: prettier, eslint, tsc, 682 Jest tests in 80
  suites, expo-doctor 20/20. New or changed tests cover every fixed item
  except M1 (harness) and L2 (measurement). Each one was seen failing before
  its fix, except the path-message test, which was written with its fix.
- T7b host harness (`securevault-evidence/t_131b87be/harness`), updated for
  the new `scratch` field and `checkSpace` signature. `run_all.sh` takes
  `T7B_SRC` and `T7B_LOGS`, and the originals are kept as `*.t7b-orig`. It
  was built from this worktree's unmodified `BackupContainer` and
  `VaultCrypto` sources on the JVM (openjdk 17) and as a Mac Catalyst binary.
  Logs are in `t_131b87be/logs-polish2/`. Results: 0 FAIL on both, 57 rows
  and 28 digests with 0 parity differences, and 27 of 28 recorded exports
  pass the pre-pass on both. The disk rows are now: no space, one byte short,
  exact, old vault frees the rest, old vault alone (`BACKUP_NO_SPACE`, L1),
  scratch one byte short (`BACKUP_NO_SPACE`), and split one byte short. The
  unit rows include `space-scratch-boundary`.
- Android: `expo prebuild --platform android` then
  `:expo-vault:compileDebugKotlin` (JDK 17, `--max-workers=4`) passed with
  no warnings in the module. `app/build.gradle` carried `versionCode 1`. The
  generated `android/` folder and the build output were removed afterwards.

## Not verified

- No runtime on a simulator, emulator or device.
  `getAllocatableBytes`, the own-cache walk, the iOS capacity figure, the
  content-URI copy on a real provider, and the RTL rendering are untested at
  runtime.
- `ExpoVaultModule.swift` was not compiled. Its only change is the
  `checkSpace` call site; `BackupContainer.swift` compiled in the harness.
- No ML Kit network capture was made, so whether uploads actually happen is
  still unverified.

## Native QA list

1. Android with `/data` nearly full: a restore needing more than the
   allocatable figure ends in `BACKUP_NO_SPACE` with the vault byte-identical.
   Also run one with a large picked backup in `cache/DocumentPicker` and
   little free space: it must refuse or restore, never lose the picked file.
2. Both platforms: a golden restore still succeeds, and each row of hostile
   set H still gets its sentence.
3. iOS network capture during OCR: record the Clearcut and firebaselogging
   hosts for the M2 decision.
4. Android scan and Files import: no `temp_import_` residue. Log the
   scanner's URI scheme.
5. RTL with Arabic month names: the details footer, and the `# 2026` and
   `# legal` chips.
6. Lockout: empty dimmed dots and the clock mark; "Checking…" at the start of
   a restore; no empty `cache/backup` after a refusal; Settings shows "1.0.0
   (1)".
7. iOS fail-closed index: repeat the QA case and check that Try again
   recovers once the cause is gone.
8. Android picker on a full disk: capture logcat to see whether it resolved
   as cancelled or rejected.
