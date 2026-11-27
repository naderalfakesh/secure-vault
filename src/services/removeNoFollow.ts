import type { Directory, File } from 'expo-file-system';

import ExpoVaultModule from '@modules/expo-vault';

// Native recursive unlink without following symlinks (expo-file-system delete on Android follows symlinks).
export function removeNoFollow(entry: File | Directory): void {
  ExpoVaultModule.removeTreeNoFollow(decodeURIComponent(entry.uri.replace(/^file:\/\//, '')));
}

// Sets iOS isExcludedFromBackup (Android backup rules already exclude filesDir).
export function excludeFromBackupQuietly(folder: Directory): void {
  try {
    ExpoVaultModule.excludeFromBackup(
      decodeURIComponent(folder.uri.replace(/^file:\/\//, '')).replace(/\/$/, ''),
    );
  } catch {
    // Re-attempted on next write.
  }
}
