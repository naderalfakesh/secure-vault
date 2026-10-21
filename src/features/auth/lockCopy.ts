import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';
import { t, tp } from '@/i18n';

import type { BiometryType } from '../../../modules/expo-vault';

/**
 * What the biometric way in is called on this phone (handover §7.3). Android
 * says "biometric unlock" so a sentence never needs two "or"s.
 */
export function biometryName(biometry: BiometryType): string {
  if (biometry === 'faceId') return t('lock.faceId');
  if (biometry === 'touchId') return t('lock.touchId');
  return Platform.OS === 'ios' ? t('lock.faceId') : t('lock.biometricUnlock');
}

export function biometryIcon(biometry: BiometryType): IconName {
  return biometry === 'faceId' ? 'faceId' : 'fingerprint';
}

/** Lock screen subtitle while biometrics are available. */
export function biometricSubtitle(biometry: BiometryType): string {
  return t('lock.biometricSubtitle', { biometry: biometryName(biometry) });
}

/** Spoken name of the keypad's biometric key. */
export function biometricKeyLabel(biometry: BiometryType): string {
  if (Platform.OS !== 'ios' && biometry === 'biometrics') return t('lock.biometricKeyAndroid');
  return t('lock.biometricKey', { biometry: biometryName(biometry) });
}

/**
 * The device's own unlock. Its prompt accepts biometrics or the device
 * passcode / screen lock, so with biometrics the label names both.
 */
export function deviceUnlockLabel(biometry: BiometryType): string {
  const fallback =
    Platform.OS === 'ios' ? t('lock.fallbackPasscode') : t('lock.fallbackScreenLock');
  if (biometry === 'none') {
    return Platform.OS === 'ios' ? t('lock.useDevicePasscode') : t('lock.useScreenLock');
  }
  return t('lock.useBiometryOr', { biometry: biometryName(biometry), fallback });
}

/** "m:ss", e.g. 0:28 or 15:00. Western digits, like the PIN. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const LOCKOUT_BODY = t('lock.lockoutBody');

export function wrongPinMessage(attemptsLeft: number): string {
  return tp('lock.wrongPin', attemptsLeft);
}
