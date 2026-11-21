import { t } from '@/i18n';
import { isKeyLocked } from '@modules/expo-vault';

import { DocumentRepository } from './DocumentRepository';
import { deleteEncryptedDatabase, openEncryptedDatabase } from './expoSqlite';
import { migrateLegacyIndex } from './migrateLegacyIndex';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import { DATABASE_FILE_ENTRY, DATABASE_KEY_ENTRY, DEFAULT_DATABASE_NAME } from './store/constants';
import { emptiedError, erasingError, keyError, nameError } from './store/errors';
import {
  copyDatabaseFile,
  deleteIndexFiles,
  installDatabaseFile,
  mainIndexFiles,
  sweepStaleDatabases,
} from './store/files';
import { currentDatabaseName, loadDatabaseKey, vaultEntries } from './store/key';
import { markLegacyImported, readLegacyIndex } from './store/legacy';

export { hasIndexFiles } from './store/files';

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

let opening: Promise<DocumentStore> | null = null;
// Connections no longer handed out but still open: replaced by a restore (a
// screen may still be using one), or closed without success. Only an erase
// closes them; a close that failed stays open until relaunch.
const abandoned: Promise<DocumentStore>[] = [];
// Connections whose setup failed and whose close failed too. Nobody uses them,
// so the next open closes them first: expo-sqlite would otherwise hand the
// retry ("Try again") the same broken connection, and only a relaunch helped.
const failedSetups: Promise<DocumentStore>[] = [];
// Set while "Delete everything" runs: an open in between would create a file
// the erase deletes under it, or one whose key the erase deletes next.
let erasing = false;
// Set once "Delete everything" succeeded: only setup may create the next key
// and index, so a screen refreshing its list in between writes nothing.
let emptied = false;

/** Setup calls this so the next open may create the key and index again after "Delete everything". */
export function allowDocumentStore(): void {
  emptied = false;
}

async function openStore(): Promise<DocumentStore> {
  if (erasing) throw erasingError();
  if (emptied) throw emptiedError();
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
      await markLegacyImported();
    }
  } catch (error) {
    // Left open, expo-sqlite would hand the same connection to the retry, and an erase's close would only release it.
    await db.close().catch(() => {
      const store = Promise.resolve({ db, repository });
      abandoned.push(store);
      failedSetups.push(store);
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
  return opening ?? share(releaseFailedSetups().then(openStore));
}

function forget(list: Promise<DocumentStore>[], store: Promise<DocumentStore>): void {
  const index = list.indexOf(store);
  if (index >= 0) list.splice(index, 1);
}

/** Best effort: one that still will not close stays for the erase, as before. */
async function releaseFailedSetups(): Promise<void> {
  for (const store of [...failedSetups]) {
    const { db } = await store;
    try {
      await db.close();
      forget(failedSetups, store);
      forget(abandoned, store);
    } catch {
      // Still open; the open goes ahead as it did before.
    }
  }
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
      forget(abandoned, store);
      forget(failedSetups, store);
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
 * away until it returns, and after a successful erase until setup calls
 * `allowDocumentStore`.
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
      throw keyError('ERASE_INCOMPLETE', t('errors.erase.indexOpen'), error);
    }
    await deleteEncryptedDatabase(name);
    deleteIndexFiles(name);
    await removeEntries();
    const left = await vaultEntries();
    if (left.includes(DATABASE_KEY_ENTRY) || left.includes(DATABASE_FILE_ENTRY)) {
      throw keyError('ERASE_INCOMPLETE', t('errors.erase.incomplete'));
    }
    emptied = true;
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
  await copyDatabaseFile(name, destPath);
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
