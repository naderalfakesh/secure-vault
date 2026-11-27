import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';
import { t, tp } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

export function biometryName(biometry: BiometryType): string {
  if (biometry === 'faceId') return t('lock.faceId');
  if (biometry === 'touchId') return t('lock.touchId');
  return Platform.OS === 'ios' ? t('lock.faceId') : t('lock.biometricUnlock');
}

export function biometryIcon(biometry: BiometryType): IconName {
  return biometry === 'faceId' ? 'faceId' : 'fingerprint';
}

export function biometricSubtitle(biometry: BiometryType): string {
  return t('lock.biometricSubtitle', { biometry: biometryName(biometry) });
}

export function biometricKeyLabel(biometry: BiometryType): string {
  if (Platform.OS !== 'ios' && biometry === 'biometrics') return t('lock.biometricKeyAndroid');
  return t('lock.biometricKey', { biometry: biometryName(biometry) });
}

export function deviceUnlockLabel(biometry: BiometryType): string {
  const fallback =
    Platform.OS === 'ios' ? t('lock.fallbackPasscode') : t('lock.fallbackScreenLock');
  if (biometry === 'none') {
    return Platform.OS === 'ios' ? t('lock.useDevicePasscode') : t('lock.useScreenLock');
  }
  return t('lock.useBiometryOr', { biometry: biometryName(biometry), fallback });
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const LOCKOUT_BODY = t('lock.lockoutBody');

export function wrongPinMessage(attemptsLeft: number): string {
  return tp('lock.wrongPin', attemptsLeft);
}
