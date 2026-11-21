import * as SecureStore from 'expo-secure-store';

/**
 * Every secure-store entry the app writes. A reinstall on iOS keeps Keychain
 * items, so the fresh-install check removes exactly this list: an entry
 * written under a name that is not here would outlive the app.
 */
export const SECURE_STORE_ENTRIES = {
  pin: 'securevault.pin',
  settings: 'securevault.settings',
  lockout: 'securevault.lockout',
  lastBackup: 'securevault.lastBackup',
  appearance: 'securevault.appearance',
} as const;

export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
