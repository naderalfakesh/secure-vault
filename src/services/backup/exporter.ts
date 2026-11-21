import { type Directory, File } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { AppError } from '@/utils/AppError';
import vault from '@modules/expo-vault';

import { removeNoFollow } from '../removeNoFollow';
import { DATABASE_ENTRY } from './constants';
import { stagingError } from './errors';
import {
  freshBackupDirectory,
  removeQuietly,
  stagingDirectory,
  subscribeProgress,
  toPath,
} from './folders';
import { backupFileName } from './format';
import { passphraseProblem } from './passphrase';
import type { BackupResult, ProgressListener } from './types';

/**
 * Writes a backup container into the cache's `backup` folder: every vault
 * entry plus a copy of the encrypted index. Nothing of the index copy or the
 * staging folder is left when it returns or throws.
 */
export async function writeBackup(
  passphrase: string,
  onProgress?: ProgressListener,
): Promise<BackupResult> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  let directory: Directory;
  let staging: Directory;
  try {
    directory = freshBackupDirectory();
    staging = stagingDirectory();
  } catch (error) {
    // Nothing was written yet; the platform error names a cache path.
    throw stagingError('BACKUP_STAGING_INVALID', error);
  }
  const name = backupFileName();
  const target = new File(directory, name);
  const databaseCopy = new File(directory, 'index.db');
  const unsubscribe = subscribeProgress(onProgress);
  let summary: { entries: number; bytes: number };
  try {
    await documentDatabase.exportTo(toPath(databaseCopy.uri));
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
    throw new AppError('BACKUP_STAGING_INVALID', 'The backup staging files could not be removed.', {
      cause: failures[0],
    });
  }
  return { uri: target.uri, name, entries: summary.entries, bytes: summary.bytes };
}

/** Removes a backup file once it has been handed off. */
export function discardBackup(uri: string): void {
  try {
    // A link planted in its place is unlinked, never followed.
    removeNoFollow(new File(uri));
  } catch {
    // Swept with the rest of the cache on lock.
  }
}
