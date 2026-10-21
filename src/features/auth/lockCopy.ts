import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';

import type { BiometryType } from '../../../modules/expo-vault';

/** What the biometric way in is called on this phone (handover §7.3). */
export function biometryName(biometry: BiometryType): string {
  if (biometry === 'faceId') return 'Face ID';
  if (biometry === 'touchId') return 'Touch ID';
  return Platform.OS === 'ios' ? 'Face ID' : 'fingerprint or face unlock';
}

export function biometryIcon(biometry: BiometryType): IconName {
  return biometry === 'faceId' ? 'faceId' : 'fingerprint';
}

/** The device's own unlock, offered next to the PIN. */
export function passcodeLabel(): string {
  return Platform.OS === 'ios' ? 'Use device passcode' : 'Use screen lock';
}

/** Lockout button: the pause covers the PIN only. */
export function lockoutUnlockLabel(biometry: BiometryType): string {
  if (biometry === 'none') return passcodeLabel();
  return `Use ${biometryName(biometry)} or ${Platform.OS === 'ios' ? 'passcode' : 'screen lock'}`;
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
