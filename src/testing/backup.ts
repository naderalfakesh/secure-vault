import { File } from 'expo-file-system';

import { type BackupResult, backupService, type ProgressListener } from '@/services/BackupService';
import vault from '@modules/expo-vault';

type ExportInternals = {
  exclusive<T>(kind: 'export', task: () => Promise<T>): Promise<T>;
  writeBackup(passphrase: string, onProgress?: ProgressListener): Promise<BackupResult>;
};

/**
 * Writes a backup into the cache, holding the export slot while it does, and
 * keeps the file for the test to read; the app only exports through
 * `exportBackup`, which hands the file to the share sheet and removes it.
 */
export function createBackup(
  passphrase: string,
  onProgress?: ProgressListener,
): Promise<BackupResult> {
  const service = backupService as unknown as ExportInternals;
  return service.exclusive('export', () => service.writeBackup(passphrase, onProgress));
}

/**
 * Stands in for the native restore that a test resolves by hand: puts the
 * restored database where the module said it would be, and the index key the
 * backup would have carried.
 */
export async function plantRestoredIndex(extrasDirectory: string): Promise<void> {
  new File(`file://${extrasDirectory}/database`).create({ overwrite: true });
  await vault.put('_database_key', 'ab'.repeat(32));
}
