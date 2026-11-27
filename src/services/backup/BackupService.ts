import { randomUUID } from 'expo-crypto';

import vault, { type BackupInfo } from '@modules/expo-vault';

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

class BackupService {
  // Held here rather than in screen state so operations survive lock unmount and stay mutually exclusive.
  private operation: BackupOperation | null = null;
  private restoreRun: RestoreRun | null = null;
  private readonly activityListeners = new Set<() => void>();

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

  async exclusive<T>(kind: BackupOperation, task: () => Promise<T>): Promise<T> {
    if (this.operation) throw busyError();
    this.setOperation(kind);
    try {
      return await task();
    } finally {
      this.setOperation(null);
    }
  }

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

  // Method wrapper so test spies can stub native backup export.
  private writeBackup(passphrase: string, onProgress?: ProgressListener): Promise<BackupResult> {
    return writeBackup(passphrase, onProgress);
  }

  discardBackup(uri: string): void {
    discardBackup(uri);
  }

  keepPickedFile(uri: string): Promise<string> {
    return keepPickedFile(uri, () => this.operation);
  }

  discardPickedFile(uri: string): void {
    discardPickedFile(uri);
  }

  // Preserves active restore folders; restore cleans them on exit.
  sweepCache(): void {
    if (this.operation === 'restore') return;
    sweepBackupFolders();
  }

  inspectBackup(uri: string): Promise<BackupInfo> {
    return vault.inspectBackup(toPath(uri));
  }

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
            // Re-check native cancel point: false means cancel was too late and restore proceeds.
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

  cancelRestore(): boolean {
    const run = this.restoreRun;
    if (!run || run.wiped) return false;
    if (vault.cancelRestore(run.id) === false) return false;
    run.cancelRequested = true;
    return true;
  }

  // Method wrapper so test spies can stub native restore.
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
