# ADR 0007: One passphrase-protected backup container for both platforms

- Status: Accepted
- Date: 2026-09-07

## Context

The prototype's backup copied the encrypted vault entries to the clipboard
as JSON. Only the same device key could ever read that, so it could not move
a vault to a new phone, and the SQLite index added in Phase 3 was not in it
at all. The plan asks for a passphrase-protected export to a file, restore
with validation and progress, and a written key hierarchy.

Two more constraints shape the design. Nothing may leave the device
unencrypted, including the temporary copy handed to the share sheet. And the
format must be the same on iOS and Android, so a backup made on one restores
on the other.

## Decision

### Format

The vault module writes a single file, `SecureVault backup <date>.svbackup`:

```
"SVB1" | be32 headerLength | header JSON
per entry: be32 metaLength | meta JSON | be64 payloadLength | payload
```

The header records the format version, the app, the creation time, the KDF
(`pbkdf2-hmac-sha256`, 600 000 iterations, a random 16-byte salt), the
cipher, and the entry count. Each entry's meta names the vault key and its
kind: `s` for a string entry, `f` for a file entry, `x` for an extra file
that is returned to the caller, and `c` for the check entry.

Payloads reuse the vault's own chunked stream from ADR 0002 (`SVC1`, 1 MiB
chunks, AES-256-GCM, chunk index as associated data), keyed with the
passphrase-derived key instead of the device key. That code already exists
and is byte-identical on both platforms, so the backup is portable for free.

### Check first, then replace

The first entry is a fixed check value. On restore the module decrypts it
before touching anything; a wrong passphrase fails the GCM tag and is
reported as `BACKUP_PASSPHRASE`. Only after the check passes are the
existing entries removed and the backup's entries written back under the
device key. The SQLite index travels as an extra entry: the service
checkpoints the WAL, copies the still-encrypted database file into the
backup, and on restore moves it back into place and reopens the store. The
database key is an ordinary string entry, so the restored file opens.

### Passphrase handling

The passphrase is typed twice in a sheet, checked for length and trivial
repetition, and passed straight to the native module. It is never stored,
logged, or kept in state beyond the sheet. Progress comes back as native
events per entry. The backup file is written to the cache, handed to the
system share sheet inside the auto-lock suspension, and deleted when the
sheet closes.

## Consequences

- A vault can move to a new phone, across platforms, with one file and one
  passphrase. Losing the passphrase loses the backup; there is no recovery
  by design.
- Restore decrypts every entry twice: once to nothing, to prove the whole
  file opens, then again to write it back. A wrong passphrase or a damaged
  entry anywhere in the file is refused with the vault untouched, at the
  cost of a second pass over the data. The write-back is not a transaction:
  a disk or key failure there leaves the vault partly restored. Staging the
  whole vault next to the old one would need as much free space again and was
  not taken. The two platforms report that failure differently. iOS rejects
  every failure after the wipe with `BACKUP_PARTIAL`. Android uses
  `BACKUP_PARTIAL` for disk, I/O and other failures, but a key failure keeps
  its own code, `KEY_LOCKED` or `KEY_INVALIDATED`, with a message that says
  the previous vault was removed: a lapsed authentication window lets the
  key-recovery prompt re-authenticate and run the whole restore again, and an
  invalidated key names its cause.
- 600 000 PBKDF2 iterations cost well under a second natively and make
  offline guessing expensive. Argon2 would be stronger per second but has no
  system implementation on either platform.
- The format is versioned; a newer header version is refused with
  `BACKUP_UNSUPPORTED` rather than misread.
- The header is unauthenticated, so a reader cannot tell a crafted header
  from one a different build wrote. Version-1 readers therefore accept only
  what version-1 exporters wrote: the KDF name, the cipher and exactly
  600 000 iterations (the only value any committed exporter has written),
  three or more entries, the check entry first, the four known kinds, unique
  keys, one `database` extra, a `_database_key` string and no trailing bytes.
  Settings outside that set are `BACKUP_UNSUPPORTED`, any other shape
  `BACKUP_INVALID`, both before the key is derived. The cost is that a backup
  from a build that never existed in this repository with other settings is
  refused, saying so and changing nothing (decision D22). Any exporter change
  to these values must bump the version.
- No size cap is set on a backup, an entry or a header. Instead, after the
  verify pass and before the wipe, the restore checks that the device has
  the memory for the largest string entry (string entries are read whole) and
  the disk for the restored vault, giving `BACKUP_RESOURCE` or
  `BACKUP_NO_SPACE` with nothing changed. The memory multipliers (three
  copies on iOS, four on Android) are estimates from the code path until they
  are measured; the checks lower the chance of a failure after the wipe and
  do not remove it.

## Alternatives considered

- Zip of re-encrypted files: extra dependency and a second container format
  next to `SVC1`.
- Encrypting the whole file in one GCM call: a multi-gigabyte vault would
  need to sit in memory, and one flipped bit would lose everything.
- Cloud backup: rejected by the app's premise; the file can go to any cloud
  the user already trusts through the share sheet.
