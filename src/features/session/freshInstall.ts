import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import vault from '../../../modules/expo-vault';
import { hasIndexFiles } from '@/data/database';
import { SESSION_MARKER_DIRECTORY } from '@/features/session/settings';

/**
 * Every secure-store entry the app writes: the session's PIN record, settings
 * and lockout (`settings.ts`), the last backup date (`lastBackup.ts`), and the
 * appearance setting (`appearance.ts`).
 */
const SECURE_STORE_ENTRIES = [
  'securevault.pin',
  'securevault.settings',
  'securevault.lockout',
  'securevault.lastBackup',
  'securevault.appearance',
];

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * `kept`: nothing was removed (a first install, an update, or a later launch).
 * `cleared`: a reinstall; the previous install's Keychain items are gone.
 * `undecided`: something could not be read or removed; nothing was decided
 * and the next launch checks again.
 */
export type InstallCheck = 'kept' | 'cleared' | 'undecided';

/** Whether any of the vault's files are on disk: its entries, the index, or the PIN markers. */
async function filesOnDisk(): Promise<boolean> {
  // The vault's entry listing is the deciding check: it throws when the folder
  // cannot be read. `.exists` below reads false on a stat error too, so the
  // index and marker checks only add evidence of an update.
  if ((await vault.getAllKeys()).length > 0) return true;
  if (hasIndexFiles()) return true;
  return new Directory(Paths.document, SESSION_MARKER_DIRECTORY).exists;
}

/**
 * iOS keeps Keychain items when the app is deleted, so a reinstall would find
 * the old device key and PIN record and open the old lock screen in front of
 * an empty vault. A flag in UserDefaults goes with the app, so on a launch
 * without it:
 *
 * - Keychain items and none of the vault's files: a reinstall. The device key
 *   and every secure-store entry are deleted, and launch goes to setup.
 * - The vault's files on disk: an update from a build before the flag, or a
 *   device backup restored. Everything is kept.
 * - Nothing at all: a first install.
 *
 * The flag is set in each of these cases. A read or delete that fails decides
 * nothing and leaves the flag unset. Android removes the Keystore key and the
 * secure store with the app, so it has nothing to check.
 */
export async function reconcileInstall(): Promise<InstallCheck> {
  if (Platform.OS !== 'ios') return 'kept';
  try {
    if (vault.hasInstallMarker()) return 'kept';
    // The files first: reading the PIN record below never marks it this way,
    // but the launch read after this does.
    if (await filesOnDisk()) {
      vault.setInstallMarker();
      return 'kept';
    }
    const [key, pin] = await Promise.all([
      vault.hasVault(),
      SecureStore.getItemAsync('securevault.pin', options),
    ]);
    if (!key && pin === null) {
      vault.setInstallMarker();
      return 'kept';
    }
    // The secure-store entries first and the key last: a run cut short never
    // leaves a PIN without its key, and while the key is there the next
    // launch finds it and finishes the job.
    await Promise.all(
      SECURE_STORE_ENTRIES.map((entry) => SecureStore.deleteItemAsync(entry, options)),
    );
    await vault.deleteDeviceKey();
    vault.setInstallMarker();
    return 'cleared';
  } catch {
    return 'undecided';
  }
}
