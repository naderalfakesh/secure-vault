import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_ENTRIES, SECURE_STORE_OPTIONS } from '@/utils/secureStore';

const ENTRY = SECURE_STORE_ENTRIES.lastBackup;

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

export async function recordLastBackup(date: Date = new Date()): Promise<void> {
  await SecureStore.setItemAsync(ENTRY, date.toISOString(), SECURE_STORE_OPTIONS).catch(() => {});
}

export async function clearLastBackup(): Promise<void> {
  await SecureStore.deleteItemAsync(ENTRY, SECURE_STORE_OPTIONS).catch(() => {});
}
