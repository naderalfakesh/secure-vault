import { Directory, type File, Paths } from 'expo-file-system';

import vault from '@modules/expo-vault';

import { removeNoFollow } from '../removeNoFollow';
import { BACKUP_DIRECTORY, BACKUP_STAGING_DIRECTORY, RESTORE_SOURCE_DIRECTORY } from './constants';
import type { ProgressListener } from './types';

export function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

/** Whether `uri` lies inside `directory`, compared as decoded paths. */
export function isInside(uri: string, directory: Directory): boolean {
  return toPath(uri).startsWith(toPath(directory.uri).replace(/\/?$/, '/'));
}

export function removeQuietly(entry: File | Directory): void {
  try {
    removeNoFollow(entry);
  } catch {
    // The caller retries: the next export, or the lock sweep for staging.
  }
}

/** Removes `directory` (a link unfollowed) when it holds nothing, quietly. */
export function removeIfEmpty(directory: Directory): void {
  try {
    if (directory.exists && directory.list().length === 0) removeNoFollow(directory);
  } catch {
    // An empty folder in the cache is harmless; the lock sweep removes it.
  }
}

export function backupDirectory() {
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
export function freshBackupDirectory() {
  const directory = new Directory(Paths.cache, BACKUP_DIRECTORY);
  removeNoFollow(directory);
  directory.create({ intermediates: true });
  return directory;
}

/** An empty staging folder; whatever an interrupted export or restore left there goes first. */
export function stagingDirectory(name = BACKUP_STAGING_DIRECTORY) {
  const directory = new Directory(Paths.cache, name);
  removeNoFollow(directory);
  directory.create({ intermediates: true });
  return directory;
}

export function restoreSourceDirectory() {
  return new Directory(Paths.document, RESTORE_SOURCE_DIRECTORY);
}

/** Forwards the vault module's progress events to `listener`; returns the unsubscribe. */
export function subscribeProgress(listener?: ProgressListener) {
  if (!listener) return () => {};
  const subscription = vault.addListener('backupProgress', listener);
  return () => subscription.remove();
}
