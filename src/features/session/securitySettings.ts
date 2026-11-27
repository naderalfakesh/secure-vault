export const AUTO_LOCK_OPTIONS = [0, 60, 300, 900, -1] as const;
export type AutoLockSeconds = (typeof AUTO_LOCK_OPTIONS)[number];

export interface SecuritySettings {
  // 0 = immediate, -1 = never
  autoLockSeconds: AutoLockSeconds;
  privacyScreen: boolean;
  biometricsForShare: boolean;
  biometricUnlock: boolean;
}

export const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockSeconds: 60,
  privacyScreen: true,
  biometricsForShare: false,
  biometricUnlock: true,
};

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
