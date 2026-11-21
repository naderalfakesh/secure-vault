import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_ENTRIES, SECURE_STORE_OPTIONS } from '@/utils/secureStore';

// "Last created on this phone": the moment the last backup was
// handed to the share sheet. A date and nothing else, so it is not sensitive;
// it lives in the OS secure store beside the appearance setting, not in the
// vault, and is cleared with the vault by Delete everything.
const ENTRY = SECURE_STORE_ENTRIES.lastBackup;

/** When the last backup was made on this phone, or null when unknown. */
export async function loadLastBackup(): Promise<Date | null> {
  try {
    const stored = await SecureStore.getItemAsync(ENTRY, SECURE_STORE_OPTIONS);
    if (!stored) return null;
    const date = new Date(stored);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/** Records a finished export. A failed write only loses the line on the hub. */
export async function recordLastBackup(date: Date = new Date()): Promise<void> {
  await SecureStore.setItemAsync(ENTRY, date.toISOString(), SECURE_STORE_OPTIONS).catch(() => {});
}

export async function clearLastBackup(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTRY, SECURE_STORE_OPTIONS).catch(() => {});
}
