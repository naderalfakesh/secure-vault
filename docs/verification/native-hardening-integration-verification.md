# Native hardening integration verification

> Verified: 2026-10-15 (partial, see "Not verified")
>
> Scope: the restore key validation and pre-pass and the backup structural
> checks brought onto the SDK 57 line, plus the remaining hardening that
> needs no format, key or policy decision: typed I/O and key-storage
> failures, no partial output, allocation failures typed, the document index
> required before the vault is cleared

## Lineage

The SDK 57 patch checkpoint (`chore: align expo sdk 57 patch versions`) did
not carry the restore-key validation commit, while the structural checks
were written on top of it. Both were cherry-picked in order onto the SDK
checkpoint; each merged without conflicts and the four native container and
crypto files came out byte-identical to the structural checks commit.

## Changes

- Encrypting a vault file reads and writes through throwing calls on iOS, so
  an I/O error is a Swift error instead of an Objective-C exception, and a
  failure on either platform removes the half-written destination.
- The iOS keychain is read through one loader that turns every status into a
  typed error with the system's own sentence: a missing item is "Vault key
  not found", anything else names the status. On Android a lapsed
  authentication window keeps `KEY_LOCKED` and a key the system invalidated
  gets `KEY_INVALIDATED`; both keep their code even after the vault was
  cleared, and the key is used once immediately before the wipe so the
  common lapsed-window case fails with nothing removed.
- Every backup the app has written carries the `database` index extra and the
  `_database_key` string entry, and the JavaScript restore depends on both. A
  backup without them used to fail only after the vault was replaced; it is
  now refused as damaged after the pre-pass, before the key is derived.
- On Android `inspectBackup` and `importBackup` catch `Throwable`, so an
  `OutOfMemoryError` from a declared length is `BACKUP_RESOURCE` before the
  wipe and `BACKUP_PARTIAL` after it, instead of an untyped rejection from the
  module runtime. Both platforms report a newer format from `inspectBackup`
  as `BACKUP_UNSUPPORTED` rather than as damage.
- iOS now rejects an empty or undecodable salt as a damaged header, as
  Android already did, so the two platforms agree on that fixture.
- A failure after the native import has replaced the vault (replacing or
  opening the index) rejects with `BACKUP_INDEX` and a sentence that says the
  documents are back but the index is not; it never claims nothing changed.
- The plaintext the container hands to the restore handler is removed when
  the handler returns, even by throwing, by the container itself and, on both
  platforms, by the handler before it probes the key or clears the vault. An
  independent review found that the Android key probe, placed before the
  handler's own cleanup, would have left the first decrypted entry in the
  cache when the authentication window had lapsed. From the first removal on,
  a failure is reported as a partial restore on both platforms, and on Android
  a vault file that cannot be removed stops the restore instead of surviving
  it.

Not changed, on purpose: the container format, the vault stream, the 600 000
iteration default and every header value the exporter writes, the device key
hierarchy, the legacy single-box files, and the export path. No numeric cap,
allowlist or ceiling was added; every new refusal is a type limit, the bytes
left in the file, a resource the device could not grant, or an entry every
committed export already contains.

## Evidence

`npm run validate` passed at the final commit (prettier, eslint, tsc, 16 Jest
suites with 67 tests including the new index-failure case, expo-doctor 21 of
21).

A harness compiled the native container, crypto and key-storage files
unmodified, in a "new" build from this tree and a "base" build from the tree
right after the structural checks were integrated, and ran them on the JVM,
on Android 16 ART in the emulator, and on the iOS 27 simulator. Besides the
40 cases of the structural verification it ran:

- four new container fixtures re-emitted from a real Android export so their
  lengths and counts agree with their contents: no `database` extra, no
  `_database_key` entry, header version 2, and a header that declares
  400 MiB (valid JSON followed by padding);
- six writer-side I/O failures on each platform: missing source, a directory
  as source, a destination under a regular file for encrypt and decrypt, and
  an input that fails after 1.5 MB (Android) or a closed descriptor (iOS);
- the Android key-failure code mapping with the real Keystore exception
  classes on ART, and the iOS keychain loader against the simulator keychain:
  a missing item, a 32-byte round trip, an item with no data, and the
  sentences for a locked device, a cancelled prompt and a failed
  authentication.

Outcomes on the new build, all three runtimes:

- The two index fixtures and every earlier malformed fixture end in
  `BACKUP_INVALID` with nothing handed to the vault writer and no temporary
  file left; version 2 ends in `BACKUP_UNSUPPORTED` from inspect and import.
- The 400 MiB header is `BACKUP_RESOURCE` from inspect and import on the JVM
  and on ART at a 512 MB heap, before any key derivation; on the simulator,
  whose process can hold it, the file parses and restores with plaintext
  digests equal to the export it was made from. The base build let the
  `OutOfMemoryError` escape on both Android runtimes, which the module
  runtime would have turned into an untyped rejection, and restored the
  two index-less fixtures, whose failure would then have come from
  JavaScript after the vault was replaced.
- Every I/O failure is a typed error and the destination does not exist
  afterwards, including the mid-stream failure, which on Android leaves the
  first chunk's ciphertext behind until the writer removes it and on iOS
  fails on the first read after the 8-byte header was written. The base
  writer has no injectable input, so that case has no base row; the other
  I/O cases already failed typed on the base build because the file could
  not be opened at all.
- The Android key-failure codes are right on ART for a lapsed window (also
  when wrapped in another exception), an invalidated key, an I/O error and an
  allocation failure. On iOS only the sentences could be checked: a process
  started with `simctl spawn` has no keychain entitlement, so loading an item
  returns status -34018, which did surface as the typed keychain error with
  the system's wording. The missing-item and round-trip branches of the
  loader therefore wait for the in-app run.
- The valid exports and the backups written by each runtime restore on every
  runtime with digests identical across runtimes and to the base build. The
  empty-salt fixture is `BACKUP_INVALID` on iOS as on Android.
- A restore whose handler throws before touching the first plaintext (the
  shape of a lapsed key window or a failed wipe) ends typed with nothing handed
  over and no decrypted temporary left, on every runtime; the build before the
  repair left one.

## Not verified

- The running app on either platform: the restore sheet with these fixtures,
  `BACKUP_RESOURCE` and `BACKUP_INDEX` shown by the sheet, the Android key
  probe with a genuinely lapsed window, and the vault and index left
  untouched. The module compiled inside the real Android app build; the iOS
  pod build is recorded with the rest of this run's evidence.
- Physical devices.
- Memory and disk preflight for the restore pass, an iteration-count policy,
  and the remaining header rules from the backup header design: these need a measured
  multiplier or an owner decision and were left out.
