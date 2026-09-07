# ADR 0002: Encrypted SQLite index with a vault-wrapped database key

- Status: Accepted
- Date: 2026-09-07

## Context

The 2025 prototype kept every document's metadata in one JSON string stored
as a vault entry. Each change re-encrypted and rewrote the whole index, search
was a linear scan over decrypted JSON in JavaScript, and nothing could be
queried without loading everything. The plan calls for indexed full-text
search across titles, tags, and extracted text, plus per-document fields
(document numbers, expiry dates) that the on-device intelligence phase will
extract.

Files are a separate concern: the prototype encrypted each file as one
AES-GCM sealed box held entirely in memory, and stored a full-size copy of the
image as the "thumbnail".

## Decision

### Index

- `expo-sqlite` built with SQLCipher and FTS5 (`useSQLCipher: true`,
  `enableFTS: true` in the config plugin). One database, `securevault.db`.
- Schema is versioned with `PRAGMA user_version`; migrations are append-only
  SQL strings applied in a transaction (`src/data/schema.ts`).
- Tables: `documents`, `pages` (ready for multi-page scans), `tags`, `fields`
  (typed extracted values, with `kind = 'date'` powering "expiring soon"), and
  a contentless FTS5 table `documents_fts` over title, tags, and OCR text with
  `unicode61 remove_diacritics 2`.
- All access goes through `DocumentRepository`. User input becomes an FTS
  query by quoting each term as a prefix (`"term"*`) joined with AND, so
  operators in the text cannot change the query.
- The repository depends on a five-method `SqlDatabase` interface. The app
  uses an expo-sqlite adapter; Jest uses better-sqlite3 in memory, so the
  repository tests run against real SQLite with FTS5 rather than a mock.
- On first open the prototype's JSON index is imported once (idempotent, keyed
  by document id) and a marker entry is written.

### Key hierarchy

1. The **device key** (AES-256, Keychain with user presence on iOS, Android
   Keystore with authentication on Android) never leaves the vault module.
2. The **database key** is 32 random bytes generated on first open and stored
   as a vault entry encrypted by the device key. SQLCipher receives it as a raw
   hex key (`PRAGMA key = "x'...'"`), so no key derivation runs on open.
3. Phase 8 adds a **backup key** derived from a passphrase; it wraps exported
   data and is never stored.

Losing the device key therefore loses the index and the files together, which
is the intended property of an on-device vault.

### Files

- New files use a streaming container: magic `SVC1`, chunk size, then one
  AES-256-GCM sealed chunk per 1 MiB with a fresh random nonce and the chunk
  index as additional authenticated data. Both platforms read and write the
  same layout; a large PDF no longer has to fit in memory, and chunks cannot
  be reordered or truncated without failing authentication.
- Files written by the prototype (no header, whole-file sealed box; on Android
  with the IV in SharedPreferences) remain readable, so an existing vault keeps
  working after the upgrade.
- Thumbnails are generated natively on write (`putThumbnail`): ImageIO
  downsampling on iOS, `BitmapFactory` sampling plus EXIF rotation on Android,
  JPEG at 80 percent, 512 px on the longest side, then encrypted like any file.

## Consequences

- Search, counts, recent lists, and category filters are SQL queries; adding
  a document no longer rewrites the whole index.
- Two encrypted stores must stay consistent. The service writes files first
  and the row last, and deletes the row last, so an interrupted operation
  leaves an orphan file rather than a row pointing at nothing. A future
  maintenance task can sweep orphans.
- The clipboard and share-sheet backup inherited from the prototype exports
  vault entries only, so it no longer carries the index. Phase 8 replaces it
  with a passphrase-protected file that includes the database.
- SQLCipher adds a native build-time dependency; Expo Go cannot run the app,
  which was already true because of the local vault module.

## Alternatives considered

- **Keep the JSON index and add an in-memory search structure.** Simpler, but
  every write still rewrites everything and the index size is bounded by
  memory and the vault entry size.
- **MMKV or another key-value store.** No relational queries, no FTS.
- **Encrypt the SQLite file with the device key directly.** The Keystore key
  on Android is not exportable, and SQLCipher needs raw key material, so a
  wrapped random key is the only option that works on both platforms.
- **Per-use Keystore authentication with CryptoObject.** Stronger, but it
  requires a biometric prompt for every file operation. The timeout-based key
  keeps one prompt per unlock; Phase 4's auto-lock bounds the window.
