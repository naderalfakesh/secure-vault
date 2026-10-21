import type { Directory, File } from 'expo-file-system';

import ExpoVaultModule from '../../modules/expo-vault';

/**
 * Removes a cache or tmp entry, a folder with everything in it, without
 * following symbolic links. expo-file-system's `delete` on Android empties a
 * link's target before removing the link, so whole-folder sweeps go through
 * the vault module instead. Throws when the entry could not be removed; a
 * missing entry is fine.
 */
export function removeNoFollow(entry: File | Directory): void {
  ExpoVaultModule.removeTreeNoFollow(decodeURIComponent(entry.uri.replace(/^file:\/\//, '')));
}

/**
 * Keeps one of the app's own folders in the documents folder out of device
 * backups (iOS sets `isExcludedFromBackup` on it, which covers what it holds;
 * Android's backup rules already leave the files folder out). Best effort:
 * the caller's write has happened either way.
 */
export function excludeFromBackupQuietly(folder: Directory): void {
  try {
    ExpoVaultModule.excludeFromBackup(
      decodeURIComponent(folder.uri.replace(/^file:\/\//, '')).replace(/\/$/, ''),
    );
  } catch {
    // Written again, and excluded again, on the next write.
  }
}
