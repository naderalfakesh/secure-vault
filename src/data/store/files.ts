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

export function mainIndexFiles(): string[] {
  try {
    const directory = databaseDirectory(DEFAULT_DATABASE_NAME);
    // .exists returns false on stat error too; pair with vaultEntries() where existence is authoritative.
    if (!directory.exists) return [];
    return directory
      .list()
      .map((entry) => entry.name)
      .filter((name) => MAIN_INDEX_FILE.test(name));
  } catch (error) {
    throw listingError(error);
  }
}

export function hasIndexFiles(): boolean {
  return mainIndexFiles().length > 0;
}

export function isRestoredName(name: string): boolean {
  return MAIN_INDEX_FILE.test(name) && name !== DEFAULT_DATABASE_NAME;
}

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
          // Still open by an abandoned connection; swept on next launch.
        }
      }
    }
  } catch {
    // Best-effort sweep.
  }
}

export function deleteIndexFiles(name: string): void {
  const directory = databaseDirectory(name);
  if (directory.exists) {
    for (const entry of directory.list()) {
      if (INDEX_FILE.test(entry.name)) entry.delete();
    }
  }
}

export async function copyDatabaseFile(name: string, destPath: string): Promise<void> {
  const source = new File(`file://${databaseFilePath(name)}`);
  const target = new File(`file://${destPath}`);
  if (target.exists) target.delete();
  await source.copy(target);
}

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
    // Roll back move so an unrecorded file isn't treated as stale.
    await target.move(new File(`file://${sourcePath}`)).catch(() => {});
    throw error;
  }
}
