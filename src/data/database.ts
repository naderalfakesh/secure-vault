import * as Crypto from 'expo-crypto';
import { Directory, File } from 'expo-file-system';

import vault from '../../modules/expo-vault';
import { isKeyLocked } from '../../modules/expo-vault/src/withKeyRecovery';
import { DocumentRepository } from './DocumentRepository';
import { databaseFilePath, deleteEncryptedDatabase, openEncryptedDatabase } from './expoSqlite';
import { migrateLegacyIndex } from './migrateLegacyIndex';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import type { DocumentMetadata } from '../types';

const DEFAULT_DATABASE_NAME = 'securevault.db';
// Which file holds the index; a restore writes a new file and points here.
const DATABASE_FILE_ENTRY = '_database_file';
const DATABASE_KEY_ENTRY = '_database_key';
const LEGACY_INDEX_ENTRY = '_documents_metadata';
const LEGACY_IMPORTED_ENTRY = '_legacy_index_imported';
// The index under any name a restore gave it, with its SQLite side files.
const INDEX_FILE = /^securevault(-\d+)?\.db(-wal|-shm|-journal)?$/;
// Only these hold an index; a side file left without its database does not.
const MAIN_INDEX_FILE = /^securevault(-\d+)?\.db$/;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A database key failure, with a sentence a screen can show as is. */
function keyError(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { code, cause });
}

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
}

/** Any failure to read a stored key; the key itself is never replaced. */
function unreadableKey(cause: unknown): Error {
  if (isKeyLocked(cause)) {
    return keyError(
      'KEY_LOCKED',
      'The device key was not unlocked, so your documents stay closed. Try again.',
      cause,
    );
  }
  if (codeOf(cause) === 'KEY_INVALIDATED') {
    return keyError(
      'KEY_INVALIDATED',
      'The device key can no longer be used, so the document index cannot be opened.',
      cause,
    );
  }
  return keyError(
    'DATABASE_KEY_UNREADABLE',
    'The document index key could not be read. Nothing was changed. Try again.',
    cause,
  );
}

/** A listing of the vault's entries or of the SQLite folder failed; nothing was read or written. */
function listingError(cause: unknown): Error {
  return keyError(
    'DATABASE_FILES_UNREADABLE',
    "The vault's files could not be read, so the document index stays closed. Nothing was changed. Try again.",
    cause,
  );
}

async function vaultEntries(): Promise<string[]> {
  try {
    return await vault.getAllKeys();
  } catch (error) {
    throw listingError(error);
  }
}

function databaseDirectory(name: string): Directory {
  const path = databaseFilePath(name);
  return new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
}

/** The main index files in the SQLite folder, under any name. */
function mainIndexFiles(): string[] {
  try {
    const directory = databaseDirectory(DEFAULT_DATABASE_NAME);
    if (!directory.exists) return [];
    return directory
      .list()
      .map((entry) => entry.name)
      .filter((name) => MAIN_INDEX_FILE.test(name));
  } catch (error) {
    throw listingError(error);
  }
}

/**
 * Key hierarchy: the device key (a Keychain item on iOS, a non-exportable
 * Keystore key on Android) is used only inside the vault module; it encrypts
 * this random database key, which SQLCipher uses for every page of the index.
 * Losing the device key loses both.
 *
 * A new key is only written when the entry is absent from the vault's listing
 * (which needs no device key) and no index file of any name exists. Writing
 * one in any other case would make an existing index unreadable for good.
 */
async function loadDatabaseKey(): Promise<string> {
  const keys = await vaultEntries();
  if (keys.includes(DATABASE_KEY_ENTRY)) {
    let existing: string;
    try {
      existing = await vault.get(DATABASE_KEY_ENTRY);
    } catch (error) {
      throw unreadableKey(error);
    }
    if (/^[0-9a-f]{64}$/i.test(existing)) return existing;
    throw unreadableKey(new Error('The stored database key is malformed.'));
  }
  // Any main index file, not only `name`, which may be the default guessed for an unreadable one.
  if (mainIndexFiles().length > 0) {
    throw keyError(
      'DATABASE_KEY_MISSING',
      'The key for the document index is missing, so the index cannot be opened. Nothing was changed.',
    );
  }
  const key = toHex(Crypto.getRandomBytes(32));
  await vault.put(DATABASE_KEY_ENTRY, key);
  return key;
}

function nameError(cause: unknown): Error {
  if (isKeyLocked(cause) || codeOf(cause) === 'KEY_INVALIDATED') return unreadableKey(cause);
  return keyError(
    'DATABASE_NAME_UNREADABLE',
    'The document index could not be found, so it stays closed. Nothing was changed. Try again.',
    cause,
  );
}

function isRestoredName(name: string): boolean {
  return MAIN_INDEX_FILE.test(name) && name !== DEFAULT_DATABASE_NAME;
}

type IndexName = { name: string; guessed: boolean };

/**
 * The index file in use; restores switch to a fresh file instead of reusing
 * the name. A vault that never stored a name uses the default, unless a
 * restored index exists: then a restore moved its file but failed to record
 * the name. A stored name that cannot be read is only replaced by the default
 * when no restored index exists, and that guess is `guessed`.
 */
async function currentDatabaseName(): Promise<IndexName> {
  let cause: unknown;
  try {
    const name = await vault.get(DATABASE_FILE_ENTRY);
    if (MAIN_INDEX_FILE.test(name)) return { name, guessed: false };
    cause = new Error('The stored index name is malformed.');
  } catch (error) {
    // A locked key says nothing about the name; guessing would point at the wrong file.
    if (isKeyLocked(error)) throw unreadableKey(error);
    cause = error;
  }
  const listed = (await vaultEntries()).includes(DATABASE_FILE_ENTRY);
  if (mainIndexFiles().some(isRestoredName)) {
    throw nameError(listed ? cause : new Error('A restored index has no stored name.'));
  }
  return { name: DEFAULT_DATABASE_NAME, guessed: listed };
}

/** Index files left behind by earlier restores; the current one is kept. */
function sweepStaleDatabases(current: string): void {
  try {
    const directory = databaseDirectory(current);
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      const { name } = entry;
      if (INDEX_FILE.test(name) && !name.startsWith(current)) {
        try {
          entry.delete();
        } catch {
          // Still open by an abandoned connection; picked up next launch.
        }
      }
    }
  } catch {
    // Sweeping is best effort.
  }
}

async function readLegacyIndex(): Promise<DocumentMetadata | null> {
  try {
    await vault.get(LEGACY_IMPORTED_ENTRY);
    return null;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
    // Not imported yet.
  }
  try {
    return JSON.parse(await vault.get(LEGACY_INDEX_ENTRY)) as DocumentMetadata;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
    return null;
  }
}

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

let opening: Promise<DocumentStore> | null = null;
// Connections no longer handed out but still open: replaced by a restore (a
// screen may still be using one), or closed without success. Only an erase
// closes them; a close that failed stays open until relaunch.
const abandoned: Promise<DocumentStore>[] = [];
// Set while "Delete everything" runs: an open in between would create a file
// the erase deletes under it, or one whose key the erase deletes next.
let erasing = false;

function erasingError(): Error {
  return keyError(
    'INDEX_ERASING',
    'The vault is being emptied, so the document index stays closed. Try again in a moment.',
  );
}

async function openStore(): Promise<DocumentStore> {
  if (erasing) throw erasingError();
  const { name, guessed } = await currentDatabaseName();
  const present = mainIndexFiles();
  const existed = present.includes(name);
  // A missing named file next to another index means the name is stale; opening
  // it would create an empty index and sweep the real one.
  if (!existed && present.length > 0) {
    throw nameError(new Error(`The index file ${name} is missing.`));
  }
  const key = await loadDatabaseKey();
  const legacy = await readLegacyIndex();
  const db = await openEncryptedDatabase(name, key);
  if (existed && !guessed) sweepStaleDatabases(name);
  const repository = new DocumentRepository(db);
  try {
    await applyMigrations(db);
    if (legacy) {
      await migrateLegacyIndex(legacy, repository);
      await vault.put(LEGACY_IMPORTED_ENTRY, new Date().toISOString());
    }
  } catch (error) {
    // Left open, expo-sqlite would hand the same connection to the retry, and an erase's close would only release it.
    await db.close().catch(() => {
      abandoned.push(Promise.resolve({ db, repository }));
    });
    throw error;
  }
  return { db, repository };
}

/** Makes `store` the one every caller gets; a failed open is forgotten so the next call retries. */
function share(store: Promise<DocumentStore>): Promise<DocumentStore> {
  const shared: Promise<DocumentStore> = store.catch((error: unknown) => {
    if (opening === shared) opening = null;
    throw error;
  });
  opening = shared;
  return shared;
}

/** Opens (once) the encrypted index, migrating schema and the prototype's JSON index. */
export function openDocumentStore(): Promise<DocumentStore> {
  return opening ?? share(openStore());
}

/**
 * Closes the open store and every abandoned one, e.g. before the vault is
 * emptied. Throws if any stays open; that one is kept in `abandoned`.
 */
export async function closeDocumentStore(): Promise<void> {
  if (opening) abandoned.push(opening);
  opening = null;
  let failure: unknown = null;
  for (const store of [...abandoned]) {
    const db = await store.then(
      (open) => open.db,
      () => null,
    );
    try {
      await db?.close();
      abandoned.splice(abandoned.indexOf(store), 1);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
}

/**
 * "Delete everything": closes the index, removes every index file, then runs
 * `removeEntries` to delete the vault's entries. SQLite only removes the WAL
 * and shared-memory files on a clean close, so a killed session leaves them
 * behind, and earlier restores may have left other names. Opens are turned
 * away until it returns, whatever the outcome.
 */
export async function deleteDocumentStore(removeEntries: () => Promise<void>): Promise<void> {
  erasing = true;
  try {
    // Only the folder and expo-sqlite's own delete need a name; every index file goes.
    const name = await currentDatabaseName().then(
      (current) => current.name,
      (error: unknown) => {
        if (isKeyLocked(error)) throw error;
        return DEFAULT_DATABASE_NAME;
      },
    );
    try {
      await closeDocumentStore();
    } catch (error) {
      // Deleting the files under a connection still open would leave it writing to an unlinked index.
      throw keyError(
        'ERASE_INCOMPLETE',
        '"Delete everything" did not finish because the document index is still open, so nothing was deleted. Close SecureVault completely, open it again, and try again.',
        error,
      );
    }
    await deleteEncryptedDatabase(name);
    const directory = databaseDirectory(name);
    if (directory.exists) {
      for (const entry of directory.list()) {
        if (INDEX_FILE.test(entry.name)) entry.delete();
      }
    }
    await removeEntries();
    const left = await vaultEntries();
    if (left.includes(DATABASE_KEY_ENTRY) || left.includes(DATABASE_FILE_ENTRY)) {
      throw keyError(
        'ERASE_INCOMPLETE',
        '"Delete everything" did not finish, so part of the vault is still on this device. Try it again.',
      );
    }
  } finally {
    erasing = false;
  }
}

/**
 * A consistent copy of the (still encrypted) database file for a backup. The
 * WAL is folded into the main file first so the copy stands on its own.
 */
export async function exportDatabaseFile(destPath: string): Promise<void> {
  const { db } = await openDocumentStore();
  await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const { name } = await currentDatabaseName();
  const source = new File(`file://${databaseFilePath(name)}`);
  const target = new File(`file://${destPath}`);
  if (target.exists) target.delete();
  await source.copy(target);
}

/**
 * Installs a database file restored from a backup under a new name and
 * points the vault at it. The previous connection is abandoned rather than
 * closed (see `abandoned`): an unlocked screen may still be using it. Whoever opens the index meanwhile waits for the new file,
 * so nothing reopens the old name or holds a connection the restore drops.
 */
export async function replaceDatabaseFile(sourcePath: string): Promise<void> {
  const previous = opening;
  if (previous) abandoned.push(previous);
  // An open already under way has read the old name and, once it finishes,
  // sweeps every other index file; the restored file must not exist yet.
  const swap = (previous ?? Promise.resolve())
    .catch(() => {})
    .then(() => installDatabaseFile(sourcePath));
  share(swap.then(openStore)).catch(() => {
    // A failed swap reaches the caller through `swap`; a failed open, whoever waits for the index.
  });
  await swap;
}

async function installDatabaseFile(sourcePath: string): Promise<void> {
  const name = `securevault-${Date.now()}.db`;
  const path = databaseFilePath(name);
  const directory = new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
  if (!directory.exists) directory.create({ intermediates: true });
  const source = new File(`file://${sourcePath}`);
  const target = new File(`file://${path}`);
  await source.move(target);
  try {
    await vault.put(DATABASE_FILE_ENTRY, name);
  } catch (error) {
    // Unnamed, the restored file would be taken for a stale one; the restore fails as a whole.
    await target.move(new File(`file://${sourcePath}`)).catch(() => {});
    throw error;
  }
}
