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

export interface BackupResult {
  uri: string;
  name: string;
  entries: number;
  bytes: number;
}

export type ProgressListener = (progress: BackupProgress) => void;

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

/** Plain-language message for a failed restore. */
export function describeBackupError(error: unknown): string {
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
    default:
      return error instanceof Error && error.message ? error.message : 'Could not use this backup.';
  }
}

function backupFileName(date = new Date()): string {
  return `SecureVault backup ${date.toISOString().slice(0, 10)}.svbackup`;
}

function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
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
  private directory() {
    const directory = new Directory(Paths.cache, 'backup');
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

  /** Writes a backup file into the cache and returns where it is. */
  async createBackup(passphrase: string, onProgress?: ProgressListener): Promise<BackupResult> {
    const problem = passphraseProblem(passphrase);
    if (problem) throw new Error(problem);
    const directory = this.directory();
    const name = backupFileName();
    const target = new File(directory, name);
    if (target.exists) target.delete();
    const databaseCopy = new File(directory, 'index.db');
    const staging = this.staging();
    const unsubscribe = this.subscribe(onProgress);
    try {
      await exportDatabaseFile(toPath(databaseCopy.uri));
      const summary = await vault.exportBackup(
        toPath(target.uri),
        passphrase,
        [{ key: DATABASE_ENTRY, path: toPath(databaseCopy.uri) }],
        toPath(staging.uri),
      );
      return { uri: target.uri, name, entries: summary.entries, bytes: summary.bytes };
    } finally {
      unsubscribe();
      if (databaseCopy.exists) databaseCopy.delete();
      if (staging.exists) staging.delete();
    }
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

  inspectBackup(uri: string): Promise<BackupInfo> {
    return vault.inspectBackup(toPath(uri));
  }

  /**
   * Replaces everything in the vault with the backup's contents. A wrong
   * passphrase or a damaged entry fails before anything is removed; the index
   * is replaced only after the native import has finished, and a failure from
   * that point on rejects with BACKUP_INDEX.
   */
  async restoreBackup(
    uri: string,
    passphrase: string,
    onProgress?: ProgressListener,
  ): Promise<number> {
    const extras = new Directory(this.directory(), 'restore');
    if (extras.exists) extras.delete();
    extras.create({ intermediates: true });
    const unsubscribe = this.subscribe(onProgress);
    try {
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
