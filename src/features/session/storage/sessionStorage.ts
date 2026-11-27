import * as SecureStore from 'expo-secure-store';

import type { LockoutState } from '@/features/auth/lockout';
import { EMPTY_LOCKOUT, sanitizeLockout, unreadableLockout } from '@/features/auth/lockout';
import { AppError } from '@/utils/AppError';
import { SECURE_STORE_ENTRIES, SECURE_STORE_OPTIONS } from '@/utils/secureStore';

import { DEFAULT_SETTINGS, sanitizeSettings, type SecuritySettings } from '../securitySettings';
import { hasMarker, LOCKOUT_MARKER, markWritten, PIN_MARKER, removeMarker } from './markers';

export type StoredRead<T> =
  { state: 'present'; value: T } | { state: 'absent' } | { state: 'unreadable'; lost?: boolean };

const { settings: SETTINGS_ENTRY, pin: PIN_ENTRY, lockout: LOCKOUT_ENTRY } = SECURE_STORE_ENTRIES;

async function readJson<T>(
  entry: string,
  sanitize: (value: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(entry, SECURE_STORE_OPTIONS);
    return raw ? sanitize(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export const sessionStorage = {
  loadSettings: () => readJson(SETTINGS_ENTRY, sanitizeSettings, DEFAULT_SETTINGS),
  saveSettings: (settings: SecuritySettings) =>
    SecureStore.setItemAsync(SETTINGS_ENTRY, JSON.stringify(settings), SECURE_STORE_OPTIONS),
  async loadLockout(): Promise<LockoutState | null> {
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(LOCKOUT_ENTRY, SECURE_STORE_OPTIONS);
    } catch {
      return null;
    }
    if (!raw) {
      let lost: boolean;
      try {
        lost = hasMarker(LOCKOUT_MARKER);
      } catch {
        lost = true;
      }
      if (!lost) return EMPTY_LOCKOUT;
      // Lost lockout writes a base pause back so it is enforced once rather than resetting.
      const replacement = unreadableLockout(Date.now());
      await sessionStorage.saveLockout(replacement).catch(() => {});
      return replacement;
    }
    markWritten(LOCKOUT_MARKER);
    try {
      return sanitizeLockout(JSON.parse(raw));
    } catch {
      const replacement = unreadableLockout(Date.now());
      await sessionStorage.saveLockout(replacement).catch(() => {});
      return replacement;
    }
  },
  async saveLockout(state: LockoutState): Promise<void> {
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify(state), SECURE_STORE_OPTIONS);
    markWritten(LOCKOUT_MARKER);
  },
  async readPinRecord(): Promise<StoredRead<string>> {
    let record: string | null;
    try {
      record = await SecureStore.getItemAsync(PIN_ENTRY, SECURE_STORE_OPTIONS);
    } catch {
      return { state: 'unreadable' };
    }
    if (record !== null) {
      markWritten(PIN_MARKER);
      return { state: 'present', value: record };
    }
    try {
      return hasMarker(PIN_MARKER) ? { state: 'unreadable', lost: true } : { state: 'absent' };
    } catch {
      return { state: 'unreadable', lost: true };
    }
  },
  async loadPinRecord(): Promise<string | null> {
    const read = await sessionStorage.readPinRecord();
    if (read.state === 'unreadable') {
      throw new AppError('PIN_UNREADABLE', 'The PIN record could not be read.');
    }
    return read.state === 'present' ? read.value : null;
  },
  async savePinRecord(record: string): Promise<void> {
    await SecureStore.setItemAsync(PIN_ENTRY, record, SECURE_STORE_OPTIONS);
    markWritten(PIN_MARKER);
  },
  // Remove markers before records so a failed delete never leaves an orphan marker.
  clear: async () => {
    removeMarker(PIN_MARKER);
    removeMarker(LOCKOUT_MARKER);
    await Promise.all(
      [SETTINGS_ENTRY, PIN_ENTRY, LOCKOUT_ENTRY].map((entry) =>
        SecureStore.deleteItemAsync(entry, SECURE_STORE_OPTIONS),
      ),
    );
  },
};
