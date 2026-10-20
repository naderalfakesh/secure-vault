import { Directory, File, Paths } from 'expo-file-system';

import { exportDatabaseFile, replaceDatabaseFile } from '@/data/database';

import vault, { type BackupInfo, type BackupProgress } from '../../modules/expo-vault';
import { documentService } from './DocumentService';

export const MIN_PASSPHRASE_LENGTH = 8;
const DATABASE_ENTRY = 'database';
/**
 * Cache folder where the vault module decrypts one entry at a time while it
 * writes a backup. It is emptied before and after every export and by the
 * lock and launch sweep in `DocumentService.clearCache`, so an export that is
 * killed mid-entry leaves at most one entry behind, and only until then.
 */
export const BACKUP_STAGING_DIRECTORY = 'backup-staging';
/** Cache folder of finished containers, the index copy, and the restore extras. */
export const BACKUP_DIRECTORY = 'backup';
/** Where the document picker copies a picked file when asked to (iOS and Android). */
export const PICKER_DIRECTORY = 'DocumentPicker';

export interface BackupResult {
  uri: string;
  name: string;
  entries: number;
  bytes: number;
}

export type ProgressListener = (progress: BackupProgress) => void;

/** Work that must never overlap another: each one rewrites the vault or the backup folders. */
export type BackupOperation = 'export' | 'restore' | 'erase';

/** A sentence explaining why a passphrase is not acceptable, or null when it is. */
export function passphraseProblem(passphrase: string, confirmation?: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  if (/^(.)\1+$/.test(passphrase)) return 'Use more than one character.';
  if (confirmation !== undefined && confirmation !== passphrase) {
    return 'The two passphrases do not match.';
  }
  return null;
}

/** Plain-language message for a failed export or restore. */
export function describeBackupError(
  error: unknown,
  fallback = 'Could not use this backup.',
): string {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  switch (code) {
    case 'BACKUP_PASSPHRASE':
      return 'That passphrase does not match this backup.';
    case 'BACKUP_INVALID':
      return 'This file is not a SecureVault backup, or it is damaged.';
    case 'BACKUP_UNSUPPORTED':
      return 'This backup was made by a newer version of the app.';
    case 'BACKUP_PARTIAL':
      return 'The restore stopped after the previous vault was removed. Restore the backup again.';
    case 'BACKUP_RESOURCE':
      return "This device doesn't have enough memory to read this backup. Nothing was changed.";
    case 'BACKUP_INDEX':
      return 'Your documents were restored, but the index could not be opened. Restore a backup again.';
    case 'BACKUP_STAGING_INVALID':
      return "The backup's temporary files could not be cleared, so no backup was made. Try again.";
    case 'BACKUP_BUSY':
      return 'A backup or restore is still running. Try again once it has finished.';
    case 'BACKUP_EXPORT_FAILED':
      return 'The backup could not be written. Check that the device has free space and try again.';
    case 'BACKUP_IMPORT_FAILED':
      return 'The restore could not start, so nothing was changed. Try again.';
    case 'GET_ALL_KEYS_FAILED':
      return "The vault's files could not be read. Try again.";
    default:
      return error instanceof Error && error.message ? error.message : fallback;
  }
}

const knownBackupErrors = new Set([
  'BACKUP_PASSPHRASE',
  'BACKUP_INVALID',
  'BACKUP_UNSUPPORTED',
  'BACKUP_PARTIAL',
  'BACKUP_RESOURCE',
  'BACKUP_INDEX',
  'BACKUP_STAGING_INVALID',
  'BACKUP_BUSY',
  'BACKUP_EXPORT_FAILED',
  'BACKUP_IMPORT_FAILED',
  'GET_ALL_KEYS_FAILED',
]);

/**
 * Like `describeBackupError`, but never the platform's own message, which can
 * name cache paths. For outcomes reported after the screen that started them
 * is gone.
 */
export function describeBackupErrorPlainly(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  return typeof code === 'string' && knownBackupErrors.has(code)
    ? describeBackupError(error)
    : fallback;
}

function backupFileName(date = new Date()): string {
  return `SecureVault backup ${date.toISOString().slice(0, 10)}.svbackup`;
}

function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function removeQuietly(entry: File | Directory): void {
  try {
    if (entry.exists) entry.delete();
  } catch {
    // The caller retries: the next export, or the lock sweep for staging.
  }
}

/**
 * A failure after the native import has replaced the vault: the documents
 * are back, the index is not. It gets its own code so the sentence never
 * claims that nothing changed.
 */
function indexError(cause: unknown): Error {
  const message =
    cause instanceof Error && cause.message ? cause.message : 'The index could not be opened.';
  return Object.assign(new Error(message), { code: 'BACKUP_INDEX', cause });
}

/**
 * Passphrase-protected backups: every vault entry plus the encrypted SQLite
 * index, written by the vault module into one container file (ADR 0007).
 * The backup key is derived from the passphrase and never stored.
 */
class BackupService {
  /**
   * The one export, restore, or erase running. It lives here rather than in a
   * screen because the lock unmounts the screen and the work goes on: a second
   * restore would delete the first one's extras after its vault entries were
   * replaced, and an export or erase would read or remove a vault mid-import.
   */
  private operation: BackupOperation | null = null;
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
    if (this.operation) {
      throw Object.assign(new Error('Another backup operation is still running.'), {
        code: 'BACKUP_BUSY',
      });
    }
    this.setOperation(kind);
    try {
      return await task();
    } finally {
      this.setOperation(null);
    }
  }

  private directory() {
    const directory = new Directory(Paths.cache, BACKUP_DIRECTORY);
    if (!directory.exists) directory.create({ intermediates: true });
    return directory;
  }

  /** An empty staging folder; whatever an interrupted export left there goes first. */
  private staging() {
    const directory = new Directory(Paths.cache, BACKUP_STAGING_DIRECTORY);
    if (directory.exists) directory.delete();
    directory.create({ intermediates: true });
    return directory;
  }

  private subscribe(listener?: ProgressListener) {
    if (!listener) return () => {};
    const subscription = vault.addListener('backupProgress', listener);
    return () => subscription.remove();
  }

  /** Writes a backup file into the cache and returns where it is; the caller discards it. */
  createBackup(passphrase: string, onProgress?: ProgressListener): Promise<BackupResult> {
    return this.exclusive('export', () => this.writeBackup(passphrase, onProgress));
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

  private async writeBackup(
    passphrase: string,
    onProgress?: ProgressListener,
  ): Promise<BackupResult> {
    const problem = passphraseProblem(passphrase);
    if (problem) throw new Error(problem);
    const directory = this.directory();
    const name = backupFileName();
    const target = new File(directory, name);
    if (target.exists) target.delete();
    const databaseCopy = new File(directory, 'index.db');
    const staging = this.staging();
    const unsubscribe = this.subscribe(onProgress);
    let summary: { entries: number; bytes: number };
    try {
      await exportDatabaseFile(toPath(databaseCopy.uri));
      summary = await vault.exportBackup(
        toPath(target.uri),
        passphrase,
        [{ key: DATABASE_ENTRY, path: toPath(databaseCopy.uri) }],
        toPath(staging.uri),
      );
    } catch (error) {
      unsubscribe();
      // The export's own error is what the caller sees (it may be KEY_LOCKED),
      // so this cleanup cannot replace it; the next export retries whatever it
      // leaves, and the lock sweep the staging folder. A failure mid-write
      // leaves a half-written container; it is ciphertext but useless, so it
      // goes too.
      for (const leftover of [target, databaseCopy, staging]) removeQuietly(leftover);
      throw error;
    }
    unsubscribe();
    // Each removal is tried even when the other fails. A finished backup is
    // not handed out while either may remain; the platform error names a
    // cache path, so it travels only as the cause.
    const failures: unknown[] = [];
    for (const leftover of [databaseCopy, staging]) {
      try {
        if (leftover.exists) leftover.delete();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      removeQuietly(target);
      throw Object.assign(new Error('The backup staging files could not be removed.'), {
        code: 'BACKUP_STAGING_INVALID',
        cause: failures[0],
      });
    }
    return { uri: target.uri, name, entries: summary.entries, bytes: summary.bytes };
  }

  /** Removes a backup file once it has been handed off. */
  discardBackup(uri: string): void {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Swept with the rest of the cache on lock.
    }
  }

  /**
   * Removes the document picker's copy of a picked backup. Anything outside
   * the picker's cache folder is the user's own file and is left alone.
   */
  discardPickedFile(uri: string): void {
    const folder = toPath(new Directory(Paths.cache, PICKER_DIRECTORY).uri).replace(/\/?$/, '/');
    if (!toPath(uri).startsWith(folder)) return;
    removeQuietly(new File(uri));
  }

  /**
   * The lock and launch sweep for backup ciphertext: finished containers,
   * the index copy, and the picker's copies. A restore in progress keeps both
   * folders, because it is still reading the picked file and writing its
   * extras; it removes them itself when it ends. An export in progress is not
   * stopped natively; it fails at its next entry because the lock's
   * `DocumentService.clearCache` removes its staging folder, and the share
   * gate deletes whatever it finished unshared.
   */
  sweepCache(): void {
    if (this.operation === 'restore') return;
    for (const name of [BACKUP_DIRECTORY, PICKER_DIRECTORY]) {
      removeQuietly(new Directory(Paths.cache, name));
    }
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
  restoreBackup(uri: string, passphrase: string, onProgress?: ProgressListener): Promise<number> {
    return this.exclusive('restore', () => this.replaceVault(uri, passphrase, onProgress));
  }

  private async replaceVault(
    uri: string,
    passphrase: string,
    onProgress?: ProgressListener,
  ): Promise<number> {
    const extras = new Directory(this.directory(), 'restore');
    let unsubscribe = () => {};
    try {
      if (extras.exists) extras.delete();
      extras.create({ intermediates: true });
      unsubscribe = this.subscribe(onProgress);
      const result = await vault.importBackup(toPath(uri), passphrase, toPath(extras.uri));
      const database = result.extras.find((extra) => extra.key === DATABASE_ENTRY);
      if (!database) throw indexError(new Error('The backup has no document index.'));
      try {
        await replaceDatabaseFile(database.path);
        await documentService.clearCache();
        await documentService.reload();
      } catch (error) {
        throw indexError(error);
      }
      return result.entries;
    } finally {
      unsubscribe();
      if (extras.exists) extras.delete();
    }
  }
}

export const backupService = new BackupService();
export default backupService;
