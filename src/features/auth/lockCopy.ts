import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';

import type { BiometryType } from '../../../modules/expo-vault';

/**
 * What the biometric way in is called on this phone (handover §7.3). Android
 * says "biometric unlock" so a sentence never needs two "or"s.
 */
export function biometryName(biometry: BiometryType): string {
  if (biometry === 'faceId') return 'Face ID';
  if (biometry === 'touchId') return 'Touch ID';
  return Platform.OS === 'ios' ? 'Face ID' : 'biometric unlock';
}

export function biometryIcon(biometry: BiometryType): IconName {
  return biometry === 'faceId' ? 'faceId' : 'fingerprint';
}

/** Lock screen subtitle while biometrics are available. */
export function biometricSubtitle(biometry: BiometryType): string {
  return `Use ${biometryName(biometry)} or enter your PIN`;
}

/** Spoken name of the keypad's biometric key. */
export function biometricKeyLabel(biometry: BiometryType): string {
  if (Platform.OS !== 'ios' && biometry === 'biometrics') return 'Unlock with fingerprint or face';
  return `Unlock with ${biometryName(biometry)}`;
}

/**
 * The device's own unlock. Its prompt accepts biometrics or the device
 * passcode / screen lock, so with biometrics the label names both.
 */
export function deviceUnlockLabel(biometry: BiometryType): string {
  const fallback = Platform.OS === 'ios' ? 'passcode' : 'screen lock';
  if (biometry === 'none') return Platform.OS === 'ios' ? 'Use device passcode' : 'Use screen lock';
  return `Use ${biometryName(biometry)} or ${fallback}`;
}

/** "m:ss", e.g. 0:28 or 15:00. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const LOCKOUT_BODY =
  'Too many wrong PINs. Each further run of wrong attempts makes the pause longer.';

export function wrongPinMessage(attemptsLeft: number): string {
  return `Wrong PIN. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left before a pause.`;
}
