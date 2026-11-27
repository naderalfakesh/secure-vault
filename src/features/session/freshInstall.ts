import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { hasIndexFiles } from '@/data/database';
import { SESSION_MARKER_DIRECTORY } from '@/features/session/settings';
import { SECURE_STORE_ENTRIES, SECURE_STORE_OPTIONS } from '@/utils/secureStore';
import vault from '@modules/expo-vault';

type InstallCheck = 'kept' | 'cleared' | 'undecided';

async function filesOnDisk(): Promise<boolean> {
  // getAllKeys throws on directory read error; .exists alone masks stat failures.
  if ((await vault.getAllKeys()).length > 0) return true;
  if (hasIndexFiles()) return true;
  return new Directory(Paths.document, SESSION_MARKER_DIRECTORY).exists;
}

// iOS Keychain survives uninstall while UserDefaults does not; clear orphaned Keychain
// entries on reinstall (no marker and no vault files on disk).
export async function reconcileInstall(): Promise<InstallCheck> {
  if (Platform.OS !== 'ios') return 'kept';
  try {
    if (vault.hasInstallMarker()) return 'kept';
    if (await filesOnDisk()) {
      vault.setInstallMarker();
      return 'kept';
    }
    const [key, pin] = await Promise.all([
      vault.hasVault(),
      SecureStore.getItemAsync(SECURE_STORE_ENTRIES.pin, SECURE_STORE_OPTIONS),
    ]);
    if (!key && pin === null) {
      vault.setInstallMarker();
      return 'kept';
    }
    // Delete secure-store entries before device key so an interrupted clear retries next launch.
    await Promise.all(
      Object.values(SECURE_STORE_ENTRIES).map((entry) =>
        SecureStore.deleteItemAsync(entry, SECURE_STORE_OPTIONS),
      ),
    );
    await vault.deleteDeviceKey();
    vault.setInstallMarker();
    return 'cleared';
  } catch {
    return 'undecided';
  }
}
