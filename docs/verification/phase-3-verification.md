# Phase 3 verification

> Verified: 2026-09-07
>
> Scope: encrypted SQLite index with FTS5, repository and migration, native thumbnails, chunked file encryption

## Outcome

The prototype's single JSON index is replaced by a SQLCipher database with
FTS5 search, accessed through a typed repository. The vault module now
generates real thumbnails and streams files through a chunked AES-256-GCM
container instead of holding whole files in memory. Existing vaults migrate on
first open and keep reading files written in the old format.
[ADR 0002](../adr/0002-encrypted-sqlite-index-and-key-hierarchy.md) records
the design and the key hierarchy.

## Native run evidence

iOS, Expo SDK 57 development client, iPhone 17 Pro simulator, iOS 26.5:

1. First launch after the upgrade with a vault holding two prototype
   documents: unlock, then Home shows both documents with their thumbnails.
   The app container now holds `SQLite/securevault.db` plus the marker entry
   `_legacy_index_imported`; the JSON index entry is left in place.
2. Adding a third document through Photos: Home updates to three documents,
   the new thumbnail entry is 58 KB against the 1.7 MB and 2.8 MB full-size
   copies the prototype stored as thumbnails, and both new entries start with
   the `SVC1` container magic while the prototype's files do not.
3. Opening the new document decrypts the chunked file and renders it; opening
   a prototype document still decrypts through the legacy path.
4. The database is opaque on disk: its first 16 bytes are not the SQLite
   header, `sqlite3` reports "file is not a database", and `strings` over the
   database and its WAL finds no titles or DDL.
5. Searching `img_00` in Documents returns IMG_0004 and IMG_0005 and not
   IMG_0111: the FTS5 unicode61 tokenizer splits on the underscore and the
   prefix query only matches number tokens starting with 00. Screenshot:
   `docs/images/search-ios.png`.

Metro logged no errors during any step.

Android, Medium Phone emulator, API 36.1, debug APK built with Gradle
workers capped at four and the emulator shut down (3 minutes 19 seconds after
the 7.5-hour thrash recorded in Phase 1):

1. The APK installs only after uninstalling the Phase 1 build; the emulator's
   data partition is too small to hold both 355 MB packages.
2. A fresh vault runs the Phase 4 first-run flow end to end: three onboarding
   slides, PIN chosen and confirmed, the system credential prompt, Home with
   the empty state. FLAG_SECURE from the privacy screen makes screenshots
   black, so the UI was read through `uiautomator dump`.
3. The photo picker opened and listed a seeded image. Choosing it took longer
   than the one-minute auto-lock and the app locked behind the picker, which
   led to the auto-lock suspension around system UI recorded in ADR 0003.
   Saving a document on Android is re-verified in the Phase 4 note with the
   next build.
4. Two defects surfaced only on Android and are fixed in Phase 4: noble's
   salt generator needs `crypto.getRandomValues`, which Hermes lacks, and the
   PIN record could not be read once the Keystore key's authentication window
   had lapsed.

## Quality gate

`npm run validate` passes: Prettier, ESLint, TypeScript 6 strict, Jest
(10 suites, 34 tests), Expo Doctor. The repository tests run against a real
SQLite with FTS5 through better-sqlite3, covering migrations, round trips,
ordering, prefix and diacritic-folded search, index maintenance on update and
delete, extracted fields with the expiring-soon query, FTS query
neutralisation, and the idempotent legacy import.

## Deferred

- Orphan sweep for files whose row write failed.
- The clipboard backup no longer includes the index; Phase 8 replaces it.
- The ML Kit `CCTPoli` log line noted in Phase 1 still appears on OCR.
