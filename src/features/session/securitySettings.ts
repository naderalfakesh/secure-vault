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
