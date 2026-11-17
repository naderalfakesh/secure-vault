import { randomUUID } from 'expo-crypto';

import vault, { type BackupInfo } from '../../../modules/expo-vault';
import { busyError, partialError } from './errors';
import { discardBackup, writeBackup } from './exporter';
import { toPath } from './folders';
import { discardPickedFile, keepPickedFile, replaceVault, sweepBackupFolders } from './restore';
import type {
  BackupOperation,
  BackupResult,
  ProgressListener,
  RestoreProgressListener,
  RestoreRun,
} from './types';

/**
 * Passphrase-protected backups: every vault entry plus the encrypted SQLite
 * index, written by the vault module into one container file (ADR 0007).
 * The backup key is derived from the passphrase and never stored.
 *
 * This class holds the one-operation-at-a-time slot and the running
 * restore; `exporter` writes containers and `restore` reads them back.
 */
class BackupService {
  /**
   * The one export, restore, or erase running. It lives here rather than in a
   * screen because the lock unmounts the screen and the work goes on: a second
   * restore would delete the first one's extras after its vault entries were
   * replaced, and an export or erase would read or remove a vault mid-import.
   */
  private operation: BackupOperation | null = null;
  private restoreRun: RestoreRun | null = null;
  private readonly activityListeners = new Set<() => void>();

  /** The operation still running, whichever screen started it. */
  readonly activity = (): BackupOperation | null => this.operation;

  readonly onActivity = (listener: () => void): (() => void) => {
    this.activityListeners.add(listener);
    return () => {
      this.activityListeners.delete(listener);
    };
  };

  private setOperation(next: BackupOperation | null) {
    this.operation = next;
    for (const listener of [...this.activityListeners]) listener();
  }

  /** Runs `task` as the only backup operation; one started meanwhile is refused with BACKUP_BUSY. */
  async exclusive<T>(kind: BackupOperation, task: () => Promise<T>): Promise<T> {
    if (this.operation) throw busyError();
    this.setOperation(kind);
    try {
      return await task();
    } finally {
      this.setOperation(null);
    }
  }

  /**
   * Writes a backup, hands it to `handOff` (the share sheet), and removes it
   * afterwards. The operation lasts until the file is gone, so a later export
   * cannot be given the same file name and then lose it to this one's cleanup.
   */
  exportBackup<T>(
    passphrase: string,
    handOff: (backup: BackupResult) => Promise<T>,
    onProgress?: ProgressListener,
  ): Promise<T> {
    return this.exclusive('export', async () => {
      const backup = await this.writeBackup(passphrase, onProgress);
      try {
        return await handOff(backup);
      } finally {
        this.discardBackup(backup.uri);
      }
    });
  }

  /** A method so `src/testing/backup.ts` can write a backup that is kept (see `exporter.writeBackup`). */
  private writeBackup(passphrase: string, onProgress?: ProgressListener): Promise<BackupResult> {
    return writeBackup(passphrase, onProgress);
  }

  /** Removes a backup file once it has been handed off. */
  discardBackup(uri: string): void {
    discardBackup(uri);
  }

  /**
   * Moves the document picker's copy of a backup out of the purgeable cache
   * into `RESTORE_SOURCE_DIRECTORY` and returns where it is now (see
   * `restore.keepPickedFile`). A file outside the picker's folder is the
   * user's own and is returned untouched.
   */
  keepPickedFile(uri: string): Promise<string> {
    return keepPickedFile(uri, () => this.operation);
  }

  /**
   * Removes a picked backup: the copy kept in `RESTORE_SOURCE_DIRECTORY`
   * (with the folder), or one still in the picker's cache folder. Anything
   * else is the user's own file and is left alone.
   */
  discardPickedFile(uri: string): void {
    discardPickedFile(uri);
  }

  /**
   * The lock and launch sweep for backup ciphertext: finished containers,
   * the index copy, the picker's copies and the picked backup kept in
   * `RESTORE_SOURCE_DIRECTORY`, plus whatever a killed restore left in its
   * staging folder. A restore in progress keeps all four folders, because it
   * is still reading the picked file and writing its
   * extras and plaintext; it removes them itself when it ends. An export in progress is not
   * stopped natively; it fails at its next entry because the lock's
   * `DocumentService.clearCache` removes its staging folder, and the share
   * gate deletes whatever it finished unshared.
   */
  sweepCache(): void {
    if (this.operation === 'restore') return;
    sweepBackupFolders();
  }

  inspectBackup(uri: string): Promise<BackupInfo> {
    return vault.inspectBackup(toPath(uri));
  }

  /**
   * Replaces everything in the vault with the backup's contents. A wrong
   * passphrase or a damaged entry fails before anything is removed; the index
   * is replaced only after the native import has finished, and a failure from
   * that point on rejects with BACKUP_INDEX.
   */
  restoreBackup(
    uri: string,
    passphrase: string,
    onProgress?: RestoreProgressListener,
  ): Promise<number> {
    return this.exclusive('restore', async () => {
      const run: RestoreRun = {
        id: randomUUID(),
        wiped: false,
        cancelRequested: false,
        lastRestored: null,
      };
      this.restoreRun = run;
      try {
        return await this.replaceVault(uri, passphrase, run.id, (event) => {
          if (event.phase === 'import') {
            run.wiped = true;
            run.cancelRequested = false;
            run.lastRestored = { entry: Math.min(event.done + 1, event.total), total: event.total };
          } else if (run.cancelRequested && !run.wiped) {
            // A request that reached the module before its call began is kept
            // for this run, but asking again costs nothing and its answer is
            // the truth: false means the restore is past its last cancel point
            // and goes ahead, so nothing may go on saying it is being cancelled.
            if (vault.cancelRestore(run.id) === false) run.cancelRequested = false;
          }
          onProgress?.({ ...event, wiped: run.wiped, cancelling: run.cancelRequested });
        });
      } catch (error) {
        throw run.wiped ? partialError(error, run.lastRestored) : error;
      } finally {
        this.restoreRun = null;
      }
    });
  }

  /**
   * Asks the running restore to stop. True only when the request will be
   * honoured: a restore is running, has not reached its first Restoring
   * event, and the module has not passed its last cancel point (it answers
   * that itself, because its progress events reach JavaScript late). The
   * restore then rejects with BACKUP_CANCELLED, with nothing changed. False
   * from the boundary on: the restore goes on and the request has no effect.
   */
  cancelRestore(): boolean {
    const run = this.restoreRun;
    if (!run || run.wiped) return false;
    // A build whose module answers nothing is taken at its word, as before.
    if (vault.cancelRestore(run.id) === false) return false;
    run.cancelRequested = true;
    return true;
  }

  /** A method so tests can stand in for the native import (see `restore.replaceVault`). */
  private replaceVault(
    uri: string,
    passphrase: string,
    runId: string,
    onProgress?: ProgressListener,
  ): Promise<number> {
    return replaceVault(uri, passphrase, runId, onProgress);
  }
}

export const backupService = new BackupService();
export default backupService;
