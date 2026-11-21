import { t } from '@/i18n';
import { isKeyLocked } from '@modules/expo-vault';

import { DocumentRepository } from './DocumentRepository';
import { migrateLegacyIndex } from './migrateLegacyIndex';
import { applyMigrations } from './schema';
import type { SqlDatabase } from './sql';
import { DEFAULT_DATABASE_NAME } from './store/constants';
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

export type DocumentStore = { db: SqlDatabase; repository: DocumentRepository };

/** The one part that needs a device: opening and deleting the encrypted SQLite file. */
export type SqlAdapter = {
  open(name: string, key: string): Promise<SqlDatabase>;
  remove(name: string): Promise<void>;
};

export class DocumentDatabase {
  private opening: Promise<DocumentStore> | null = null;
  // Connections no longer handed out but still open: replaced by a restore (a
  // screen may still be using one), or closed without success. Only an erase
  // closes them; a close that failed stays open until relaunch.
  private readonly abandoned: Promise<DocumentStore>[] = [];
  // Connections whose setup failed and whose close failed too. Nobody uses them,
  // so the next open closes them first: expo-sqlite would otherwise hand the
  // retry ("Try again") the same broken connection, and only a relaunch helped.
  private readonly failedSetups: Promise<DocumentStore>[] = [];
  // Set while "Delete everything" runs: an open in between would create a file
  // the erase deletes under it, or one whose key the erase deletes next.
  private erasing = false;
  // Set once "Delete everything" succeeded: only setup may create the next key
  // and index, so a screen refreshing its list in between writes nothing.
  private emptied = false;

  constructor(private readonly adapter: SqlAdapter) {}

  /** Setup calls this so the next open may create the key and index again after "Delete everything". */
  allow(): void {
    this.emptied = false;
  }

  private async openStore(): Promise<DocumentStore> {
    if (this.erasing) throw erasingError();
    if (this.emptied) throw emptiedError();
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
    const db = await this.adapter.open(name, key);
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
        this.abandoned.push(store);
        this.failedSetups.push(store);
      });
      throw error;
    }
    return { db, repository };
  }

  /** Makes `store` the one every caller gets; a failed open is forgotten so the next call retries. */
  private share(store: Promise<DocumentStore>): Promise<DocumentStore> {
    const shared: Promise<DocumentStore> = store.catch((error: unknown) => {
      if (this.opening === shared) this.opening = null;
      throw error;
    });
    this.opening = shared;
    return shared;
  }

  /** Opens (once) the encrypted index, migrating schema and the prototype's JSON index. */
  open(): Promise<DocumentStore> {
    return this.opening ?? this.share(this.releaseFailedSetups().then(() => this.openStore()));
  }

  private forget(list: Promise<DocumentStore>[], store: Promise<DocumentStore>): void {
    const index = list.indexOf(store);
    if (index >= 0) list.splice(index, 1);
  }

  /** Best effort: one that still will not close stays for the erase, as before. */
  private async releaseFailedSetups(): Promise<void> {
    for (const store of [...this.failedSetups]) {
      const { db } = await store;
      try {
        await db.close();
        this.forget(this.failedSetups, store);
        this.forget(this.abandoned, store);
      } catch {
        // Still open; the open goes ahead as it did before.
      }
    }
  }

  /**
   * Closes the open store and every abandoned one, e.g. before the vault is
   * emptied. Throws if any stays open; that one is kept in `abandoned`.
   */
  async close(): Promise<void> {
    if (this.opening) this.abandoned.push(this.opening);
    this.opening = null;
    let failure: unknown = null;
    for (const store of [...this.abandoned]) {
      const db = await store.then(
        (open) => open.db,
        () => null,
      );
      try {
        await db?.close();
        this.forget(this.abandoned, store);
        this.forget(this.failedSetups, store);
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
   * `allow`.
   */
  async erase(removeEntries: () => Promise<void>): Promise<void> {
    this.erasing = true;
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
        await this.close();
      } catch (error) {
        // Deleting the files under a connection still open would leave it writing to an unlinked index.
        throw keyError('ERASE_INCOMPLETE', t('errors.erase.indexOpen'), error);
      }
      await this.adapter.remove(name);
      deleteIndexFiles(name);
      await removeEntries();
      const left = await vaultEntries();
      // Encrypted documents count too: nothing is meant to survive an erase.
      if (left.length > 0) {
        throw keyError('ERASE_INCOMPLETE', t('errors.erase.incomplete'));
      }
      this.emptied = true;
    } finally {
      this.erasing = false;
    }
  }

  /**
   * A consistent copy of the (still encrypted) database file for a backup. The
   * WAL is folded into the main file first so the copy stands on its own.
   */
  async exportTo(destPath: string): Promise<void> {
    const { db } = await this.open();
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
  async replaceWith(sourcePath: string): Promise<void> {
    const previous = this.opening;
    if (previous) this.abandoned.push(previous);
    // An open already under way has read the old name and, once it finishes,
    // sweeps every other index file; the restored file must not exist yet.
    const swap = (previous ?? Promise.resolve())
      .catch(() => {})
      .then(() => installDatabaseFile(sourcePath));
    this.share(swap.then(() => this.openStore())).catch(() => {
      // A failed swap reaches the caller through `swap`; a failed open, whoever waits for the index.
    });
    await swap;
  }
}
