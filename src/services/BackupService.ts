import { Directory, File, Paths } from 'expo-file-system';

import { t } from '@/i18n';
import { exportDatabaseFile, replaceDatabaseFile } from '@/data/database';

import { KEY_INVALIDATED_MESSAGE } from '@/utils/errors';

import vault, { type BackupInfo, type BackupProgress } from '../../modules/expo-vault';
import { documentService, PICKER_DIRECTORY } from './DocumentService';
import { excludeFromBackupQuietly, removeNoFollow } from './removeNoFollow';

export const MIN_PASSPHRASE_LENGTH = 8;
const DATABASE_ENTRY = 'database';
/**
 * Cache folder where the vault module decrypts one entry at a time while it
 * writes a backup. It is emptied before and after every export and by the
 * lock and launch sweep in `DocumentService.clearCache`, so an export that is
 * killed mid-entry leaves at most one entry behind, and only until then.
 */
export const BACKUP_STAGING_DIRECTORY = 'backup-staging';
/**
 * Cache folder for a restore's payload copies and decrypted entries. The
 * module empties it before and after every restore, `replaceVault` removes
 * it, and `sweepCache` removes it at launch and at any lock with no restore
 * running, so a restore killed mid-entry leaves plaintext only until the next
 * launch.
 */
export const RESTORE_STAGING_DIRECTORY = 'restore-staging';
/** Cache folder of finished containers, the index copy, and the restore extras. */
export const BACKUP_DIRECTORY = 'backup';
/**
 * Folder in the app's documents (Android `files`, iOS `Documents`) that the
 * document picker's copy of a backup is moved into before it is inspected.
 * The cache is purgeable: under low storage Android's storage service and
 * iOS may delete a picked backup there while its restore sheet is open. The
 * vault module removes this exact folder without following links, and
 * `sweepCache` removes it at lock and launch like the cache folders.
 */
export const RESTORE_SOURCE_DIRECTORY = 'restore-source';
/** The picked backup's name inside `RESTORE_SOURCE_DIRECTORY`; the picker's own name never reaches the disk. */
const RESTORE_SOURCE_FILE = 'picked.svbackup';

export interface BackupResult {
  uri: string;
  name: string;
  entries: number;
  bytes: number;
}

export type ProgressListener = (progress: BackupProgress) => void;

/**
 * A restore's progress with its phase signal. `wiped` turns true on the first
 * Restoring (`import`) event and stays true for the rest of the restore, a
 * retry after a new key prompt included: from then on the previous vault may
 * be gone, so nothing may say it is unchanged and it can no longer be
 * cancelled. `cancelling` is true while an accepted cancel still stands; it
 * turns false when the module refuses the repeated request (it had passed
 * its last cancel point), and the restore then goes on to its own outcome.
 */
export type RestoreProgress = BackupProgress & { wiped: boolean; cancelling: boolean };
export type RestoreProgressListener = (progress: RestoreProgress) => void;

/** The restore that holds the slot: its phase signal and whether a cancel was asked for. */
interface RestoreRun {
  wiped: boolean;
  cancelRequested: boolean;
  /**
   * For "Stopped at entry X of N": the entry after the last one the Restoring
   * pass finished, numbered like its progress (the check entry is entry 1).
   */
  lastRestored: { entry: number; total: number } | null;
}

/** Work that must never overlap another: each one rewrites the vault or the backup folders. */
export type BackupOperation = 'export' | 'restore' | 'erase';

/** A sentence explaining why a passphrase is not acceptable, or null when it is. */
export function passphraseProblem(passphrase: string, confirmation?: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return t('backup.passphrase.tooShort', { count: MIN_PASSPHRASE_LENGTH });
  }
  if (/^(.)\1+$/.test(passphrase)) return t('backup.passphrase.oneCharacter');
  if (confirmation !== undefined && confirmation !== passphrase) {
    return t('backup.passphrase.mismatch');
  }
  return null;
}

/** Plain-language message for a failed export or restore. */
export function describeBackupError(error: unknown, fallback = t('backup.error.fallback')): string {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  switch (code) {
    case 'BACKUP_PASSPHRASE':
      return t('backup.error.passphrase');
    case 'BACKUP_INVALID':
      return t('backup.error.invalid');
    case 'BACKUP_UNSUPPORTED':
      return t('backup.error.unsupported');
    case 'BACKUP_PARTIAL':
      return t('backup.error.partial');
    case 'BACKUP_RESOURCE':
      return t('backup.error.resource');
    case 'BACKUP_NO_SPACE':
      return t('backup.error.noSpace');
    case 'BACKUP_INDEX':
      return t('backup.error.index');
    case 'BACKUP_CANCELLED':
      return t('backup.error.cancelled');
    // Only ever seen before the wipe: the service names one after it BACKUP_PARTIAL.
    case 'KEY_LOCKED':
      return t('backup.error.keyLocked');
    case 'KEY_INVALIDATED':
      return t('backup.error.keyInvalidated', { message: KEY_INVALIDATED_MESSAGE });
    case 'BACKUP_STAGING_INVALID':
      return t('backup.error.staging');
    case 'BACKUP_RESTORE_STAGING_INVALID':
      return t('backup.error.restoreStaging');
    case 'BACKUP_BUSY':
      return t('backup.error.busy');
    case 'BACKUP_EXPORT_FAILED':
      return t('backup.error.exportFailed');
    case 'BACKUP_IMPORT_FAILED':
      return t('backup.error.importFailed');
    case 'GET_ALL_KEYS_FAILED':
      return t('backup.error.keysFailed');
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
  'BACKUP_NO_SPACE',
  'BACKUP_INDEX',
  'BACKUP_CANCELLED',
  'KEY_LOCKED',
  'KEY_INVALIDATED',
  'BACKUP_STAGING_INVALID',
  'BACKUP_RESTORE_STAGING_INVALID',
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

/** The brand and the extension are never translated; only the middle is. */
const BACKUP_BRAND = 'SecureVault';
const BACKUP_EXTENSION = '.svbackup';

/** The calendar date on this device, YYYY-MM-DD: the day the user made the backup, not UTC's. */
function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function backupFileName(date = new Date()): string {
  const middle = t('backup.fileName', { date: localDate(date) });
  return `${BACKUP_BRAND} ${middle}${BACKUP_EXTENSION}`;
}

function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function removeQuietly(entry: File | Directory): void {
  try {
    removeNoFollow(entry);
  } catch {
    // The caller retries: the next export, or the lock sweep for staging.
  }
}

/** Removes `directory` (a link unfollowed) when it holds nothing, quietly. */
function removeIfEmpty(directory: Directory): void {
  try {
    if (directory.exists && directory.list().length === 0) removeNoFollow(directory);
  } catch {
    // An empty folder in the cache is harmless; the lock sweep removes it.
  }
}

/** The staging folders could not be prepared, so nothing was written or replaced. */
function stagingError(code: string, cause: unknown): Error {
  return Object.assign(new Error('The backup staging folders could not be prepared.'), {
    code,
    cause,
  });
}

/**
 * A failure after the native import has replaced the vault: the documents
 * are back, the index is not. It gets its own code so the sentence never
 * claims that nothing changed.
 */
function indexError(cause: unknown): Error {
  const message =
    // i18n-ignore: an error cause; describeBackupError speaks BACKUP_INDEX from the table
    cause instanceof Error && cause.message ? cause.message : 'The index could not be opened.';
  return Object.assign(new Error(message), { code: 'BACKUP_INDEX', cause });
}

/**
 * A failure after the first Restoring event. The previous vault may be gone
 * whatever the native code says (a key failure keeps its own code across the
 * wipe so the key recovery wrapper can retry, and a retry's own refusals say
 * nothing about the first attempt's wipe), so only BACKUP_INDEX keeps its
 * code; everything else is a partial restore.
 */
function partialError(cause: unknown, stoppedAt: RestoreRun['lastRestored']): Error {
  const code =
    typeof cause === 'object' && cause !== null ? (cause as { code?: unknown }).code : null;
  if (code === 'BACKUP_INDEX') return cause as Error;
  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : // i18n-ignore: an error cause; describeBackupError speaks BACKUP_PARTIAL from the table
        'The restore stopped after the previous vault was removed.';
  return Object.assign(new Error(message), { code: 'BACKUP_PARTIAL', cause, stoppedAt });
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

  /**
   * An empty `backup` folder for an export. Nothing else uses it while an
   * export holds the slot, so whatever is there goes first, a link planted in
   * its place included (unlinked, never followed), before the index copy or
   * the container is written into it.
   */
  private freshDirectory() {
    const directory = new Directory(Paths.cache, BACKUP_DIRECTORY);
    removeNoFollow(directory);
    directory.create({ intermediates: true });
    return directory;
  }

  /** An empty staging folder; whatever an interrupted export or restore left there goes first. */
  private staging(name = BACKUP_STAGING_DIRECTORY) {
    const directory = new Directory(Paths.cache, name);
    removeNoFollow(directory);
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
    let directory: Directory;
    let staging: Directory;
    try {
      directory = this.freshDirectory();
      staging = this.staging();
    } catch (error) {
      // Nothing was written yet; the platform error names a cache path.
      throw stagingError('BACKUP_STAGING_INVALID', error);
    }
    const name = backupFileName();
    const target = new File(directory, name);
    const databaseCopy = new File(directory, 'index.db');
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
        removeNoFollow(leftover);
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

  private restoreSource() {
    return new Directory(Paths.document, RESTORE_SOURCE_DIRECTORY);
  }

  /** Whether `uri` lies inside `directory`, compared as decoded paths. */
  private static isInside(uri: string, directory: Directory): boolean {
    return toPath(uri).startsWith(toPath(directory.uri).replace(/\/?$/, '/'));
  }

  /**
   * Moves the document picker's copy of a backup out of the purgeable cache
   * into `RESTORE_SOURCE_DIRECTORY` and returns where it is now; the cache
   * copy is gone once this resolves. The move stays on the app's own volume,
   * so it takes no extra space, and the restore's disk check counts the file
   * as used, not as room. A file outside the picker's folder is the user's
   * own and is returned untouched. On failure nothing is kept: the cache copy
   * and the folder are removed and the error is BACKUP_RESTORE_STAGING_INVALID.
   */
  async keepPickedFile(uri: string): Promise<string> {
    if (!BackupService.isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return uri;
    const folder = this.restoreSource();
    try {
      // A running restore still reads the last one.
      if (this.operation === 'restore') {
        throw Object.assign(new Error('Another backup operation is still running.'), {
          code: 'BACKUP_BUSY',
        });
      }
      // Whatever an earlier pick left, a link planted in its place included.
      removeNoFollow(folder);
      folder.create({ intermediates: true });
      // Ciphertext that is gone after the restore has no place in a device backup.
      excludeFromBackupQuietly(folder);
      const target = new File(folder, RESTORE_SOURCE_FILE);
      await new File(uri).move(target);
      return new File(folder, RESTORE_SOURCE_FILE).uri;
    } catch (error) {
      removeQuietly(new File(uri));
      if (this.operation !== 'restore') removeQuietly(folder);
      const code = (error as { code?: unknown } | null)?.code;
      if (code === 'BACKUP_BUSY') throw error;
      throw stagingError('BACKUP_RESTORE_STAGING_INVALID', error);
    }
  }

  /**
   * Removes a picked backup: the copy kept in `RESTORE_SOURCE_DIRECTORY`
   * (with the folder), or one still in the picker's cache folder. Anything
   * else is the user's own file and is left alone.
   */
  discardPickedFile(uri: string): void {
    if (BackupService.isInside(uri, this.restoreSource())) {
      removeQuietly(this.restoreSource());
      return;
    }
    if (!BackupService.isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return;
    removeQuietly(new File(uri));
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
    for (const name of [BACKUP_DIRECTORY, PICKER_DIRECTORY, RESTORE_STAGING_DIRECTORY]) {
      removeQuietly(new Directory(Paths.cache, name));
    }
    removeQuietly(this.restoreSource());
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
      const run: RestoreRun = { wiped: false, cancelRequested: false, lastRestored: null };
      this.restoreRun = run;
      try {
        return await this.replaceVault(uri, passphrase, (event) => {
          if (event.phase === 'import') {
            run.wiped = true;
            run.cancelRequested = false;
            run.lastRestored = { entry: Math.min(event.done + 1, event.total), total: event.total };
          } else if (run.cancelRequested && !run.wiped) {
            // A request that reached the module before its call began is kept
            // for it, but asking again costs nothing and its answer is the
            // truth: false means the restore is past its last cancel point and
            // goes ahead, so nothing may go on saying it is being cancelled.
            if (vault.cancelRestore() === false) run.cancelRequested = false;
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
    if (vault.cancelRestore() === false) return false;
    run.cancelRequested = true;
    return true;
  }

  private async replaceVault(
    uri: string,
    passphrase: string,
    onProgress?: ProgressListener,
  ): Promise<number> {
    const extras = new Directory(Paths.cache, BACKUP_DIRECTORY, 'restore');
    let staging: Directory | null = null;
    let unsubscribe = () => {};
    try {
      try {
        this.directory();
        // Refused when `backup` is a link to somewhere outside the cache.
        removeNoFollow(extras);
        extras.create({ intermediates: true });
        staging = this.staging(RESTORE_STAGING_DIRECTORY);
      } catch (error) {
        // Nothing was read or replaced yet; the platform error names a cache path.
        throw stagingError('BACKUP_RESTORE_STAGING_INVALID', error);
      }
      unsubscribe = this.subscribe(onProgress);
      const result = await vault.importBackup(
        toPath(uri),
        passphrase,
        toPath(extras.uri),
        toPath(staging.uri),
      );
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
      // The module has already emptied the staging folder; this and the launch sweep are backstops.
      if (staging) removeQuietly(staging);
      // Never masks the outcome; the lock sweep removes `backup` with whatever is left.
      removeQuietly(extras);
      // The restore made `backup` only for its extras; an empty one is not left behind.
      removeIfEmpty(new Directory(Paths.cache, BACKUP_DIRECTORY));
    }
  }
}

export const backupService = new BackupService();
export default backupService;
