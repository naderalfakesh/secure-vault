import { Directory, File, Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { errorCode } from '@/utils/errors';
import vault from '@modules/expo-vault';

import { documentService, PICKER_DIRECTORY } from '../document';
import { excludeFromBackupQuietly, removeNoFollow } from '../removeNoFollow';
import {
  BACKUP_DIRECTORY,
  DATABASE_ENTRY,
  RESTORE_SOURCE_FILE,
  RESTORE_STAGING_DIRECTORY,
} from './constants';
import { busyError, indexError, stagingError } from './errors';
import {
  backupDirectory,
  isInside,
  removeIfEmpty,
  removeQuietly,
  restoreSourceDirectory,
  stagingDirectory,
  subscribeProgress,
  toPath,
} from './folders';
import type { BackupOperation, ProgressListener } from './types';

/**
 * Moves the document picker's copy of a backup out of the purgeable cache
 * into `RESTORE_SOURCE_DIRECTORY` and returns where it is now; the cache
 * copy is gone once this resolves. The move stays on the app's own volume,
 * so it takes no extra space, and the restore's disk check counts the file
 * as used, not as room. A file outside the picker's folder is the user's
 * own and is returned untouched. On failure nothing is kept: the cache copy
 * and the folder are removed and the error is BACKUP_RESTORE_STAGING_INVALID.
 * `activity` is read at each step, since a restore may start meanwhile.
 */
export async function keepPickedFile(
  uri: string,
  activity: () => BackupOperation | null,
): Promise<string> {
  if (!isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return uri;
  const folder = restoreSourceDirectory();
  try {
    // A running restore still reads the last one.
    if (activity() === 'restore') throw busyError();
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
    if (activity() !== 'restore') removeQuietly(folder);
    if (errorCode(error) === 'BACKUP_BUSY') throw error;
    throw stagingError('BACKUP_RESTORE_STAGING_INVALID', error);
  }
}

/**
 * Removes a picked backup: the copy kept in `RESTORE_SOURCE_DIRECTORY`
 * (with the folder), or one still in the picker's cache folder. Anything
 * else is the user's own file and is left alone.
 */
export function discardPickedFile(uri: string): void {
  if (isInside(uri, restoreSourceDirectory())) {
    removeQuietly(restoreSourceDirectory());
    return;
  }
  if (!isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return;
  removeQuietly(new File(uri));
}

/** Removes the backup folders, the picker's copies and the picked backup kept for a restore. */
export function sweepBackupFolders(): void {
  for (const name of [BACKUP_DIRECTORY, PICKER_DIRECTORY, RESTORE_STAGING_DIRECTORY]) {
    removeQuietly(new Directory(Paths.cache, name));
  }
  removeQuietly(restoreSourceDirectory());
}

/**
 * Replaces everything in the vault with the backup's contents, then the
 * index with the backup's copy. A failure once the native import has
 * finished rejects with BACKUP_INDEX.
 */
export async function replaceVault(
  uri: string,
  passphrase: string,
  runId: string,
  onProgress?: ProgressListener,
): Promise<number> {
  const extras = new Directory(Paths.cache, BACKUP_DIRECTORY, 'restore');
  let staging: Directory | null = null;
  let unsubscribe = () => {};
  try {
    try {
      backupDirectory();
      // Refused when `backup` is a link to somewhere outside the cache.
      removeNoFollow(extras);
      extras.create({ intermediates: true });
      staging = stagingDirectory(RESTORE_STAGING_DIRECTORY);
    } catch (error) {
      // Nothing was read or replaced yet; the platform error names a cache path.
      throw stagingError('BACKUP_RESTORE_STAGING_INVALID', error);
    }
    unsubscribe = subscribeProgress(onProgress);
    const result = await vault.importBackup(
      toPath(uri),
      passphrase,
      toPath(extras.uri),
      toPath(staging.uri),
      runId,
    );
    const database = result.extras.find((extra) => extra.key === DATABASE_ENTRY);
    if (!database) throw indexError(new Error('The backup has no document index.'));
    try {
      await documentDatabase.replaceWith(database.path);
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
