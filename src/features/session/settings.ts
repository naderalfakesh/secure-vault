import type { LockoutState } from '@/features/auth/lockout';
import { EMPTY_LOCKOUT, sanitizeLockout } from '@/features/auth/lockout';

import vault from '../../../modules/expo-vault';

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

// Vault entries (encrypted by the device key) that hold session state.
const SETTINGS_ENTRY = '_security_settings';
const PIN_ENTRY = '_pin_record';
const LOCKOUT_ENTRY = '_pin_lockout';

async function readJson<T>(
  entry: string,
  sanitize: (value: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    return sanitize(JSON.parse(await vault.get(entry)));
  } catch {
    return fallback;
  }
}

export const sessionStorage = {
  loadSettings: () => readJson(SETTINGS_ENTRY, sanitizeSettings, DEFAULT_SETTINGS),
  saveSettings: (settings: SecuritySettings) => vault.put(SETTINGS_ENTRY, JSON.stringify(settings)),
  loadLockout: (): Promise<LockoutState> => readJson(LOCKOUT_ENTRY, sanitizeLockout, EMPTY_LOCKOUT),
  saveLockout: (state: LockoutState) => vault.put(LOCKOUT_ENTRY, JSON.stringify(state)),
  async loadPinRecord(): Promise<string | null> {
    try {
      return await vault.get(PIN_ENTRY);
    } catch {
      return null;
    }
  },
  savePinRecord: (record: string) => vault.put(PIN_ENTRY, record),
};
