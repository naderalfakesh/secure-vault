import type { LockoutState } from '@/features/auth/lockout';
import { EMPTY_LOCKOUT, sanitizeLockout } from '@/features/auth/lockout';

import * as SecureStore from 'expo-secure-store';

export const AUTO_LOCK_OPTIONS = [0, 60, 300, 900, -1] as const;
export type AutoLockSeconds = (typeof AUTO_LOCK_OPTIONS)[number];

export interface SecuritySettings {
  /** Seconds in the background before the vault locks; 0 = immediately, -1 = never. */
  autoLockSeconds: AutoLockSeconds;
  /** Blur the app in the switcher and block screenshots. */
  privacyScreen: boolean;
  /** Ask for biometrics again before sharing a decrypted file. */
  biometricsForShare: boolean;
}

export const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockSeconds: 60,
  privacyScreen: true,
  biometricsForShare: false,
};

export function autoLockLabel(seconds: AutoLockSeconds): string {
  if (seconds === 0) return 'Immediately';
  if (seconds === -1) return 'Never';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = seconds / 60;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Sentence for the Settings row, e.g. "After 1 minute in the background". */
export function autoLockDescription(seconds: AutoLockSeconds): string {
  if (seconds === 0) return 'As soon as you leave the app';
  if (seconds === -1) return 'Stays open until you lock it';
  return `After ${autoLockLabel(seconds)} in the background`;
}

/** Coerces whatever was persisted into valid settings. */
export function sanitizeSettings(value: unknown): SecuritySettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const raw = value as Partial<Record<keyof SecuritySettings, unknown>>;
  const autoLock = AUTO_LOCK_OPTIONS.find((option) => option === raw.autoLockSeconds);
  return {
    autoLockSeconds: autoLock ?? DEFAULT_SETTINGS.autoLockSeconds,
    privacyScreen:
      typeof raw.privacyScreen === 'boolean' ? raw.privacyScreen : DEFAULT_SETTINGS.privacyScreen,
    biometricsForShare:
      typeof raw.biometricsForShare === 'boolean'
        ? raw.biometricsForShare
        : DEFAULT_SETTINGS.biometricsForShare,
  };
}

// Session state lives in the OS secure store (Keychain, Keystore-backed
// SharedPreferences) rather than behind the vault's device key: the PIN record
// and lockout must be readable before that key has been authenticated, and the
// record is only a stretched hash.
const SETTINGS_ENTRY = 'securevault.settings';
const PIN_ENTRY = 'securevault.pin';
const LOCKOUT_ENTRY = 'securevault.lockout';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function readJson<T>(
  entry: string,
  sanitize: (value: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(entry, options);
    return raw ? sanitize(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export const sessionStorage = {
  loadSettings: () => readJson(SETTINGS_ENTRY, sanitizeSettings, DEFAULT_SETTINGS),
  saveSettings: (settings: SecuritySettings) =>
    SecureStore.setItemAsync(SETTINGS_ENTRY, JSON.stringify(settings), options),
  loadLockout: (): Promise<LockoutState> => readJson(LOCKOUT_ENTRY, sanitizeLockout, EMPTY_LOCKOUT),
  saveLockout: (state: LockoutState) =>
    SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify(state), options),
  async loadPinRecord(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(PIN_ENTRY, options);
    } catch {
      return null;
    }
  },
  savePinRecord: (record: string) => SecureStore.setItemAsync(PIN_ENTRY, record, options),
  hasPinRecord: async () => (await sessionStorage.loadPinRecord()) !== null,
  clear: async () => {
    await Promise.all(
      [SETTINGS_ENTRY, PIN_ENTRY, LOCKOUT_ENTRY].map((entry) =>
        SecureStore.deleteItemAsync(entry, options),
      ),
    );
  },
};
