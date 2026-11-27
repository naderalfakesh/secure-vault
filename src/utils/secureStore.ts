import * as SecureStore from 'expo-secure-store';

// iOS Keychain survives reinstall; fresh-install cleanup deletes exactly these keys.
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
