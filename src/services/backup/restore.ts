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

// Move picker copies out of purgeable cache into Documents so low-storage cleanup cannot drop them mid-restore.
export async function keepPickedFile(
  uri: string,
  activity: () => BackupOperation | null,
): Promise<string> {
  if (!isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return uri;
  const folder = restoreSourceDirectory();
  try {
    if (activity() === 'restore') throw busyError();
    removeNoFollow(folder);
    folder.create({ intermediates: true });
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

export function discardPickedFile(uri: string): void {
  if (isInside(uri, restoreSourceDirectory())) {
    removeQuietly(restoreSourceDirectory());
    return;
  }
  if (!isInside(uri, new Directory(Paths.cache, PICKER_DIRECTORY))) return;
  removeQuietly(new File(uri));
}

export function sweepBackupFolders(): void {
  for (const name of [BACKUP_DIRECTORY, PICKER_DIRECTORY, RESTORE_STAGING_DIRECTORY]) {
    removeQuietly(new Directory(Paths.cache, name));
  }
  removeQuietly(restoreSourceDirectory());
}

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
      removeNoFollow(extras);
      extras.create({ intermediates: true });
      staging = stagingDirectory(RESTORE_STAGING_DIRECTORY);
    } catch (error) {
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
    if (staging) removeQuietly(staging);
    removeQuietly(extras);
    removeIfEmpty(new Directory(Paths.cache, BACKUP_DIRECTORY));
  }
}
