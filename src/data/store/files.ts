import { Directory, File } from 'expo-file-system';

import vault from '@modules/expo-vault';

import { databaseFilePath } from '../expoSqlite';
import {
  DATABASE_FILE_ENTRY,
  DEFAULT_DATABASE_NAME,
  INDEX_FILE,
  MAIN_INDEX_FILE,
} from './constants';
import { listingError } from './errors';

function databaseDirectory(name: string): Directory {
  const path = databaseFilePath(name);
  return new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
}

/** The main index files in the SQLite folder, under any name. */
export function mainIndexFiles(): string[] {
  try {
    const directory = databaseDirectory(DEFAULT_DATABASE_NAME);
    // `.exists` also reads false on a stat error; the vault's entry listing,
    // which throws, is the deciding check wherever this one is used with it.
    if (!directory.exists) return [];
    return directory
      .list()
      .map((entry) => entry.name)
      .filter((name) => MAIN_INDEX_FILE.test(name));
  } catch (error) {
    throw listingError(error);
  }
}

/**
 * Whether the SQLite folder holds an index file under any name; throws a
 * typed DATABASE_FILES_UNREADABLE when the folder cannot be listed.
 */
export function hasIndexFiles(): boolean {
  return mainIndexFiles().length > 0;
}

export function isRestoredName(name: string): boolean {
  return MAIN_INDEX_FILE.test(name) && name !== DEFAULT_DATABASE_NAME;
}

/** Index files left behind by earlier restores; the current one is kept. */
export function sweepStaleDatabases(current: string): void {
  try {
    const directory = databaseDirectory(current);
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      const { name } = entry;
      if (INDEX_FILE.test(name) && !name.startsWith(current)) {
        try {
          entry.delete();
        } catch {
          // Still open by an abandoned connection; picked up next launch.
        }
      }
    }
  } catch {
    // Sweeping is best effort.
  }
}

/** Every index file in the SQLite folder, under any name, with its side files. Throws on failure. */
export function deleteIndexFiles(name: string): void {
  const directory = databaseDirectory(name);
  if (directory.exists) {
    for (const entry of directory.list()) {
      if (INDEX_FILE.test(entry.name)) entry.delete();
    }
  }
}

/** Copies the index file `name` to `destPath`, replacing whatever is there. */
export async function copyDatabaseFile(name: string, destPath: string): Promise<void> {
  const source = new File(`file://${databaseFilePath(name)}`);
  const target = new File(`file://${destPath}`);
  if (target.exists) target.delete();
  await source.copy(target);
}

/** Moves a restored index file in under a fresh name and records that name in the vault. */
export async function installDatabaseFile(sourcePath: string): Promise<void> {
  const name = `securevault-${Date.now()}.db`;
  const path = databaseFilePath(name);
  const directory = new Directory(`file://${path.slice(0, path.lastIndexOf('/'))}`);
  if (!directory.exists) directory.create({ intermediates: true });
  const source = new File(`file://${sourcePath}`);
  const target = new File(`file://${path}`);
  await source.move(target);
  try {
    await vault.put(DATABASE_FILE_ENTRY, name);
  } catch (error) {
    // Unnamed, the restored file would be taken for a stale one. The vault's entries are already
    // replaced, so the restore ends as a partial one with BACKUP_INDEX.
    await target.move(new File(`file://${sourcePath}`)).catch(() => {});
    throw error;
  }
}
