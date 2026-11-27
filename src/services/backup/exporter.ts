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
    // Preserve original export error (e.g. KEY_LOCKED); sweep handles any leftover cleanup failure.
    for (const leftover of [target, databaseCopy, staging]) removeQuietly(leftover);
    throw error;
  }
  unsubscribe();
  // Attempt all removals and refuse to hand out the backup if staging cleanup failed.
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

export function discardBackup(uri: string): void {
  try {
    removeNoFollow(new File(uri));
  } catch {
    // Swept on next lock.
  }
}
