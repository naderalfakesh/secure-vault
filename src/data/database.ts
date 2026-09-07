import * as Crypto from 'expo-crypto';
import { Directory, File } from 'expo-file-system';

import vault from '../../modules/expo-vault';
import { DocumentRepository } from './DocumentRepository';
import { databaseFilePath, deleteEncryptedDatabase, openEncryptedDatabase } from './expoSqlite';
import { migrateLegacyIndex } from './migrateLegacyIndex';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import type { DocumentMetadata } from '../types';

const DATABASE_NAME = 'securevault.db';
const DATABASE_KEY_ENTRY = '_database_key';
const LEGACY_INDEX_ENTRY = '_documents_metadata';
const LEGACY_IMPORTED_ENTRY = '_legacy_index_imported';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Key hierarchy: the device key in the Keychain or Keystore never leaves the
 * vault module; it encrypts this random database key, which SQLCipher uses
 * for every page of the index. Losing the device key loses both.
 */
async function loadDatabaseKey(): Promise<string> {
  try {
    const existing = await vault.get(DATABASE_KEY_ENTRY);
    if (/^[0-9a-f]{64}$/i.test(existing)) return existing;
  } catch {
    // First run: no key yet.
  }
  const key = toHex(Crypto.getRandomBytes(32));
  await vault.put(DATABASE_KEY_ENTRY, key);
  return key;
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

/** Opens (once) the encrypted index, migrating schema and the prototype's JSON index. */
export function openDocumentStore(): Promise<DocumentStore> {
  if (!opening) {
    opening = (async () => {
      const key = await loadDatabaseKey();
      const db = await openEncryptedDatabase(DATABASE_NAME, key);
      await applyMigrations(db);
      const repository = new DocumentRepository(db);
      const legacy = await readLegacyIndex();
      if (legacy) {
        await migrateLegacyIndex(legacy, repository);
        await vault.put(LEGACY_IMPORTED_ENTRY, new Date().toISOString());
      }
      return { db, repository };
    })().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

/** Forget the open store, e.g. after the vault was emptied or restored. */
export async function closeDocumentStore(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) {
    const { db } = await current.catch(() => ({ db: null }));
    await db?.close();
  }
}

/** Close the index and remove its file, for "Delete everything". */
export async function deleteDocumentStore(): Promise<void> {
  await closeDocumentStore();
  await deleteEncryptedDatabase(DATABASE_NAME);
}

/**
 * A consistent copy of the (still encrypted) database file for a backup. The
 * WAL is folded into the main file first so the copy stands on its own.
 */
export async function exportDatabaseFile(destPath: string): Promise<void> {
  const { db } = await openDocumentStore();
  await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const source = new File(`file://${databaseFilePath(DATABASE_NAME)}`);
  const target = new File(`file://${destPath}`);
  if (target.exists) target.delete();
  source.copy(target);
}

/** Replaces the database file with one restored from a backup; the caller reopens the store. */
export async function replaceDatabaseFile(sourcePath: string): Promise<void> {
  await closeDocumentStore();
  const path = databaseFilePath(DATABASE_NAME);
  const directory = new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
  if (!directory.exists) directory.create({ intermediates: true });
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const stale = new File(`file://${path}${suffix}`);
    if (stale.exists) stale.delete();
  }
  new File(`file://${sourcePath}`).move(new File(`file://${path}`));
}
