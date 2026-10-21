import * as SecureStore from 'expo-secure-store';

// "Last created on this phone" (handover F10): the moment the last backup was
// handed to the share sheet. A date and nothing else, so it is not sensitive;
// it lives in the OS secure store beside the appearance setting, not in the
// vault, and is cleared with the vault by Delete everything.
const ENTRY = 'securevault.lastBackup';
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** When the last backup was made on this phone, or null when unknown. */
export async function loadLastBackup(): Promise<Date | null> {
  try {
    const stored = await SecureStore.getItemAsync(ENTRY, options);
    if (!stored) return null;
    const date = new Date(stored);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/** Records a finished export. A failed write only loses the line on the hub. */
export async function recordLastBackup(date: Date = new Date()): Promise<void> {
  await SecureStore.setItemAsync(ENTRY, date.toISOString(), options).catch(() => {});
}

export async function clearLastBackup(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTRY, options).catch(() => {});
}
