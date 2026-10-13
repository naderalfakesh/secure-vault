# Backup container structural input verification

> Verified: 2026-10-13 (partial, see "Not verified")
>
> Scope: malformed and truncated backup and vault files on the native read
> paths of both platforms; no format, KDF or size policy change

## Changes

- Every length read from a backup (header, entry metadata, payload) or from a
  vault file chunk is compared with the bytes left in the file before a buffer
  is allocated. A chunk must also hold at least a nonce and a tag.
- The second pass over a backup reads each entry through the same bounded
  reader as the pre-pass, so a file that changes between passes is refused
  with a typed error instead of being trusted.
- The header's entry count and PBKDF2 iterations must fit the types the
  platform uses them as (`Int`, `UInt32`, `PBEKeySpec`), and the Android salt
  must decode to at least one byte. These are representability checks, not a
  KDF policy: there is no ceiling and no allowlist.
- iOS reads through the throwing `FileHandle.read(upToCount:)` and writes
  restored plaintext through `write(contentsOf:)`, so I/O errors are Swift
  errors rather than Objective-C exceptions.
- A failed `decryptFile` removes its destination on both platforms, so no
  partial plaintext is left behind. A chunked vault file that stops inside
  its header is now refused on iOS instead of decrypting to an empty file.
- Android reports structural chunk errors as `VaultCrypto.CorruptException`;
  the restore path still maps every entry failure to `BACKUP_INVALID`.

The writer, the container layout, the 600 000 iteration default, the legacy
paths and the module's error codes are unchanged.

## Evidence

A harness compiled the four changed native files unmodified and ran 40 cases
on three runtimes: the iOS 27 simulator, Android 16 (API 36) ART on the
emulator, and the JVM. The cases were derived byte for byte from a real
Android export: header, entry and chunk lengths of 0, 11, 27, `0x7fffffff`
and `0xffffffff`, cut files, iterations of -1, 0 and 2^33, entry counts of
-1, 2^32 and 2^31-1, empty and non-Base64 salts, files changed between passes,
and multi-chunk vault files with a bad tag, a bad length or a cut chunk.

- Every malformed backup ended in `BACKUP_INVALID` before the vault would have
  been touched, with no temporary file left. The one exception is the empty
  salt on iOS, which still ends in `BACKUP_PASSPHRASE`. A file changed during
  the second pass ends in `BACKUP_PARTIAL`, as documented for that pass.
- Before the change, the same files crashed Android with `OutOfMemoryError`
  (header, chunk and changed-file lengths) and trapped iOS on iterations -1
  and 2^33. Others surfaced as `BACKUP_IMPORT_FAILED`, and an entry count of
  2^32 was accepted as an empty backup on Android. iOS restored a vault file
  cut inside its header as empty, and failed decrypts left 1 to 2 MB of
  plaintext behind.
- Real iOS and Android app exports (600 000 iterations) and a backup written
  by each platform restore on every runtime, with plaintext digests identical
  across runtimes and to the code before the change. A wrong passphrase is
  still `BACKUP_PASSPHRASE` with nothing restored.

## Not verified

- The app itself was not rebuilt, so the restore sheet, the
  `ExpoVaultModule` error mapping and the vault directories were not
  exercised in the running app on either platform. The module files are
  unchanged, and the harness mirrors their mapping.
- Physical devices.
