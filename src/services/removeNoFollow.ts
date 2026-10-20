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
