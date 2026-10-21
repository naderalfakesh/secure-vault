import type { LockoutState } from '@/features/auth/lockout';
import { EMPTY_LOCKOUT, sanitizeLockout, unreadableLockout } from '@/features/auth/lockout';
import { t, tp } from '@/i18n';

import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

export const AUTO_LOCK_OPTIONS = [0, 60, 300, 900, -1] as const;
export type AutoLockSeconds = (typeof AUTO_LOCK_OPTIONS)[number];

export interface SecuritySettings {
  /** Seconds in the background before the vault locks; 0 = immediately, -1 = never. */
  autoLockSeconds: AutoLockSeconds;
  /** Privacy cover: a solid cover in the app switcher, and no screenshots. */
  privacyScreen: boolean;
  /** Ask for biometrics again before sharing a decrypted file. */
  biometricsForShare: boolean;
  /**
   * The lock screen opens the biometric prompt on its own and shows the
   * biometric key. Off, it asks for the PIN first; the device-unlock button
   * and the OS prompt for the device key stay as they are.
   */
  biometricUnlock: boolean;
}

export const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockSeconds: 60,
  privacyScreen: true,
  biometricsForShare: false,
  biometricUnlock: true,
};

export function autoLockLabel(seconds: AutoLockSeconds): string {
  if (seconds === 0) return t('settings.autoLock.immediately');
  if (seconds === -1) return t('settings.autoLock.never');
  if (seconds < 60) return t('settings.autoLock.seconds', { count: seconds });
  return tp('settings.autoLock.minutes', seconds / 60);
}

/** A choice on the Auto-lock page: "Immediately", "After 5 minutes", "Never". */
export function autoLockChoice(seconds: AutoLockSeconds): string {
  if (seconds === 0 || seconds === -1) return autoLockLabel(seconds);
  return t('settings.autoLock.after', { duration: autoLockLabel(seconds) });
}

/** Sentence for the Settings row, e.g. "After 1 minute in the background". */
export function autoLockDescription(seconds: AutoLockSeconds): string {
  if (seconds === 0) return t('settings.autoLock.onLeave');
  if (seconds === -1) return t('settings.autoLock.untilLocked');
  return t('settings.autoLock.afterBackground', { duration: autoLockLabel(seconds) });
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
    biometricUnlock:
      typeof raw.biometricUnlock === 'boolean'
        ? raw.biometricUnlock
        : DEFAULT_SETTINGS.biometricUnlock,
  };
}

// Session state lives in the OS secure store (Keychain, Keystore-backed
// SharedPreferences) rather than behind the vault's device key: the PIN record
// and lockout must be readable before that key has been authenticated, and the
// record is only a stretched hash.
/**
 * A secure-store read that tells "not there" apart from "could not be read".
 * `lost` marks a record whose marker says it was written but that the store
 * no longer returns (or whose marker could not be checked).
 */
export type StoredRead<T> =
  { state: 'present'; value: T } | { state: 'absent' } | { state: 'unreadable'; lost?: boolean };

/**
 * expo-secure-store on Android deletes an entry it can no longer decrypt
 * ("out of sync with the keystore") and returns null, so a missing record
 * alone does not prove none was written. Each record therefore has a plain,
 * non-secret marker file next to the vault's entries, written after the
 * record and removed before it: a marker without its record means the record
 * was lost, never that there is none. The markers hold no data, and their
 * names are not vault entry names, so the vault's listing, backups and
 * restores never see them.
 */
export const SESSION_MARKER_DIRECTORY = 'securevault-session';
const PIN_MARKER = 'pin';
const LOCKOUT_MARKER = 'lockout';

const markerDirectory = () => new Directory(Paths.document, SESSION_MARKER_DIRECTORY);
const markerFile = (name: string) => new File(markerDirectory(), name);

/** Whether the marker exists; throws when that cannot be told. */
const hasMarker = (name: string) => markerFile(name).exists;

/**
 * Writes the marker after its record was stored. A failure is left for the
 * next read of the record to repair, so it never fails the write it follows.
 */
function markWritten(name: string) {
  try {
    const file = markerFile(name);
    if (!file.exists) file.create({ intermediates: true });
  } catch {
    // Repaired by the next read that finds the record.
  }
}

/** Removes the marker before its record goes; throws when it stays. */
function removeMarker(name: string) {
  const file = markerFile(name);
  if (file.exists) file.delete();
  if (file.exists) throw new Error(`The ${name} marker could not be removed.`);
}

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
  /**
   * The stored lockout, or null when the store could not be read. Content that
   * is not JSON is replaced with a base pause, so it is judged once, not anew
   * on every read.
   */
  async loadLockout(): Promise<LockoutState | null> {
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(LOCKOUT_ENTRY, options);
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
      // Written once and gone now: a pause that ends on its own, written back
      // so it is judged once, never a reset of the count.
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
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify(state), options);
    markWritten(LOCKOUT_MARKER);
  },
  /**
   * Whether a PIN record exists, kept apart from a store that refused the
   * read: an unreadable record is not a missing one, and setup must never
   * replace a PIN it could not see. A record its marker says was written is
   * `unreadable` and `lost` when the store returns nothing for it.
   */
  async readPinRecord(): Promise<StoredRead<string>> {
    let record: string | null;
    try {
      record = await SecureStore.getItemAsync(PIN_ENTRY, options);
    } catch {
      return { state: 'unreadable' };
    }
    if (record !== null) {
      // Also marks a record written before markers existed.
      markWritten(PIN_MARKER);
      return { state: 'present', value: record };
    }
    try {
      return hasMarker(PIN_MARKER) ? { state: 'unreadable', lost: true } : { state: 'absent' };
    } catch {
      return { state: 'unreadable', lost: true };
    }
  },
  /** The PIN record, or null when there is none; rejects with `PIN_UNREADABLE` when the store refused. */
  async loadPinRecord(): Promise<string | null> {
    const read = await sessionStorage.readPinRecord();
    if (read.state === 'unreadable') {
      throw Object.assign(new Error('The PIN record could not be read.'), {
        code: 'PIN_UNREADABLE',
      });
    }
    return read.state === 'present' ? read.value : null;
  },
  async savePinRecord(record: string): Promise<void> {
    await SecureStore.setItemAsync(PIN_ENTRY, record, options);
    markWritten(PIN_MARKER);
  },
  /**
   * Removes the markers first, so a record whose delete fails still has its
   * marker, and a marker never outlives a record that is gone.
   */
  clear: async () => {
    removeMarker(PIN_MARKER);
    removeMarker(LOCKOUT_MARKER);
    await Promise.all(
      [SETTINGS_ENTRY, PIN_ENTRY, LOCKOUT_ENTRY].map((entry) =>
        SecureStore.deleteItemAsync(entry, options),
      ),
    );
  },
};
