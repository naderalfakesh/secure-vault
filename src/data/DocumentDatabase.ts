import { t } from '@/i18n';
import { isKeyLocked } from '@modules/expo-vault';

import { DocumentRepository } from './DocumentRepository';
import { migrateLegacyIndex } from './migrateLegacyIndex';
import { applyMigrations } from './schema';
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
import type { DocumentStore, SqlAdapter } from './store/types';

export type { DocumentStore, SqlAdapter } from './store/types';

export class DocumentDatabase {
  private opening: Promise<DocumentStore> | null = null;
  // Old connections left open across restore or failed close; closed only on erase.
  private readonly abandoned: Promise<DocumentStore>[] = [];
  // Closed before the next open so expo-sqlite does not hand back a broken connection.
  private readonly failedSetups: Promise<DocumentStore>[] = [];
  private erasing = false;
  // Blocks lazy opens after erase until setup calls allow().
  private emptied = false;

  constructor(private readonly adapter: SqlAdapter) {}

  allow(): void {
    this.emptied = false;
  }

  private async openStore(): Promise<DocumentStore> {
    if (this.erasing) throw erasingError();
    if (this.emptied) throw emptiedError();
    const { name, guessed } = await currentDatabaseName();
    const present = mainIndexFiles();
    const existed = present.includes(name);
    // Stale stored name next to another index; opening it would create an empty DB and sweep the real one.
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
      await db.close().catch(() => {
        const store = Promise.resolve({ db, repository });
        this.abandoned.push(store);
        this.failedSetups.push(store);
      });
      throw error;
    }
    return { db, repository };
  }

  private share(store: Promise<DocumentStore>): Promise<DocumentStore> {
    const shared: Promise<DocumentStore> = store.catch((error: unknown) => {
      if (this.opening === shared) this.opening = null;
      throw error;
    });
    this.opening = shared;
    return shared;
  }

  open(): Promise<DocumentStore> {
    return this.opening ?? this.share(this.releaseFailedSetups().then(() => this.openStore()));
  }

  private forget(list: Promise<DocumentStore>[], store: Promise<DocumentStore>): void {
    const index = list.indexOf(store);
    if (index >= 0) list.splice(index, 1);
  }

  private async releaseFailedSetups(): Promise<void> {
    for (const store of [...this.failedSetups]) {
      const { db } = await store;
      try {
        await db.close();
        this.forget(this.failedSetups, store);
        this.forget(this.abandoned, store);
      } catch {
        // Still open; retried on erase.
      }
    }
  }

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

  async erase(removeEntries: () => Promise<void>): Promise<void> {
    this.erasing = true;
    try {
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
        // Deleting files under an open connection would leave it writing to an unlinked index.
        throw keyError('ERASE_INCOMPLETE', t('errors.erase.indexOpen'), error);
      }
      await this.adapter.remove(name);
      deleteIndexFiles(name);
      await removeEntries();
      const left = await vaultEntries();
      if (left.length > 0) {
        throw keyError('ERASE_INCOMPLETE', t('errors.erase.incomplete'));
      }
      this.emptied = true;
    } finally {
      this.erasing = false;
    }
  }

  async exportTo(destPath: string): Promise<void> {
    const { db } = await this.open();
    await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const { name } = await currentDatabaseName();
    await copyDatabaseFile(name, destPath);
  }

  async replaceWith(sourcePath: string): Promise<void> {
    const previous = this.opening;
    if (previous) this.abandoned.push(previous);
    // Wait for any in-flight open so its stale-DB sweep cannot delete the newly installed file.
    const swap = (previous ?? Promise.resolve())
      .catch(() => {})
      .then(() => installDatabaseFile(sourcePath));
    this.share(swap.then(() => this.openStore())).catch(() => {});
    await swap;
  }
}
