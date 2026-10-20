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

function databaseDirectory(name: string): Directory {
  const path = databaseFilePath(name);
  return new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
}

/** Any main index file, not only `name`, which may be the default guessed for an unreadable one. */
function indexFileExists(name: string): boolean {
  try {
    const directory = databaseDirectory(name);
    return directory.exists && directory.list().some((entry) => MAIN_INDEX_FILE.test(entry.name));
  } catch (error) {
    throw unreadableKey(error);
  }
}

/**
 * Key hierarchy: the device key in the Keychain or Keystore never leaves the
 * vault module; it encrypts this random database key, which SQLCipher uses
 * for every page of the index. Losing the device key loses both.
 *
 * A new key is only written when the entry is absent from the vault's listing
 * (which needs no device key) and no index file of any name exists. Writing
 * one in any other case would make an existing index unreadable for good.
 */
async function loadDatabaseKey(name: string): Promise<string> {
  let keys: string[];
  try {
    keys = await vault.getAllKeys();
  } catch (error) {
    throw unreadableKey(error);
  }
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
  if (indexFileExists(name)) {
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

/** A main index file under a restored name, which only `_database_file` can point at. */
function restoredIndexExists(): boolean {
  const directory = databaseDirectory(DEFAULT_DATABASE_NAME);
  if (!directory.exists) return false;
  return directory
    .list()
    .some((entry) => MAIN_INDEX_FILE.test(entry.name) && entry.name !== DEFAULT_DATABASE_NAME);
}

type IndexName = { name: string; guessed: boolean };

/**
 * The index file in use; restores switch to a fresh file instead of reusing
 * the name. A vault that never stored a name uses the default. A stored name
 * that cannot be read is only replaced by the default when no restored index
 * exists, and that guess is `guessed` so nothing is swept on its strength.
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
  let keys: string[];
  try {
    keys = await vault.getAllKeys();
  } catch (error) {
    throw unreadableKey(error);
  }
  if (!keys.includes(DATABASE_FILE_ENTRY)) return { name: DEFAULT_DATABASE_NAME, guessed: false };
  let restored: boolean;
  try {
    restored = restoredIndexExists();
  } catch (error) {
    throw nameError(error);
  }
  if (restored) throw nameError(cause);
  return { name: DEFAULT_DATABASE_NAME, guessed: true };
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
  } catch {
    // Not imported yet.
  }
  try {
    return JSON.parse(await vault.get(LEGACY_INDEX_ENTRY)) as DocumentMetadata;
  } catch {
    return null;
  }
}

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

let opening: Promise<DocumentStore> | null = null;
// Connections replaced by a restore. They are never closed: closing a
// connection right after the native import crashed inside SQLite's FTS5
// teardown, and an idle open connection costs nothing until relaunch.
const abandoned: Promise<DocumentStore>[] = [];

async function openStore(): Promise<DocumentStore> {
  const { name, guessed } = await currentDatabaseName();
  const key = await loadDatabaseKey(name);
  const db = await openEncryptedDatabase(name, key);
  if (!guessed) sweepStaleDatabases(name);
  await applyMigrations(db);
  const repository = new DocumentRepository(db);
  const legacy = await readLegacyIndex();
  if (legacy) {
    await migrateLegacyIndex(legacy, repository);
    await vault.put(LEGACY_IMPORTED_ENTRY, new Date().toISOString());
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

/** Close the open store, e.g. before the vault is emptied. */
export async function closeDocumentStore(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) {
    const { db } = await current.catch(() => ({ db: null }));
    await db?.close();
  }
}

/**
 * Close the index and remove every index file, for "Delete everything". SQLite
 * only removes the WAL and shared-memory files on a clean close, so a killed
 * session leaves them behind, and earlier restores may have left other names.
 */
export async function deleteDocumentStore(): Promise<void> {
  // Only the folder and expo-sqlite's own delete need a name; every index file goes.
  const name = await currentDatabaseName().then(
    (current) => current.name,
    (error: unknown) => {
      if (isKeyLocked(error)) throw error;
      return DEFAULT_DATABASE_NAME;
    },
  );
  await closeDocumentStore();
  await deleteEncryptedDatabase(name);
  const directory = databaseDirectory(name);
  if (!directory.exists) return;
  for (const entry of directory.list()) {
    if (INDEX_FILE.test(entry.name)) entry.delete();
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
 * closed (see `abandoned`): an unlocked screen may still be running a
 * statement on it. Whoever opens the index meanwhile waits for the new file,
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
  await new File(`file://${sourcePath}`).move(new File(`file://${path}`));
  await vault.put(DATABASE_FILE_ENTRY, name);
}
