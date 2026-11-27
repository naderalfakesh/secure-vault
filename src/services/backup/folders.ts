import { Directory, type File, Paths } from 'expo-file-system';

import vault from '@modules/expo-vault';

import { removeNoFollow } from '../removeNoFollow';
import { BACKUP_DIRECTORY, BACKUP_STAGING_DIRECTORY, RESTORE_SOURCE_DIRECTORY } from './constants';
import type { ProgressListener } from './types';

export function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export function isInside(uri: string, directory: Directory): boolean {
  return toPath(uri).startsWith(toPath(directory.uri).replace(/\/?$/, '/'));
}

export function removeQuietly(entry: File | Directory): void {
  try {
    removeNoFollow(entry);
  } catch {
    // Retried by subsequent export or lock sweep.
  }
}

export function removeIfEmpty(directory: Directory): void {
  try {
    if (directory.exists && directory.list().length === 0) removeNoFollow(directory);
  } catch {
    // Swept on lock.
  }
}

export function backupDirectory() {
  const directory = new Directory(Paths.cache, BACKUP_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function freshBackupDirectory() {
  const directory = new Directory(Paths.cache, BACKUP_DIRECTORY);
  removeNoFollow(directory);
  directory.create({ intermediates: true });
  return directory;
}

export function stagingDirectory(name = BACKUP_STAGING_DIRECTORY) {
  const directory = new Directory(Paths.cache, name);
  removeNoFollow(directory);
  directory.create({ intermediates: true });
  return directory;
}

export function restoreSourceDirectory() {
  return new Directory(Paths.document, RESTORE_SOURCE_DIRECTORY);
}

export function subscribeProgress(listener?: ProgressListener) {
  if (!listener) return () => {};
  const subscription = vault.addListener('backupProgress', listener);
  return () => subscription.remove();
}
