import { Platform } from 'react-native';

import type { BiometryType } from '../../../modules/expo-vault';

/** Intro step 3 (handover §7.5), worded for the biometric this phone has. */
export function unlockSlideBody(biometry: BiometryType): string {
  const rest =
    'A 6-digit PIN is always there as a backup, and the vault locks itself when you leave.';
  if (Platform.OS !== 'ios') {
    return biometry === 'none'
      ? `Your screen lock opens the vault. ${rest}`
      : `Your fingerprint or face opens the vault. ${rest}`;
  }
  if (biometry === 'faceId') return `Face ID opens the vault. ${rest}`;
  if (biometry === 'touchId') return `Touch ID opens the vault. ${rest}`;
  if (biometry === 'biometrics') return `Face ID or Touch ID opens the vault. ${rest}`;
  return `Your device passcode opens the vault. ${rest}`;
}

/** The Choose PIN subtitle. */
export function choosePinHint(biometry: BiometryType): string {
  if (biometry === 'none') return 'You’ll use it with your device passcode to open the vault.';
  if (Platform.OS !== 'ios') {
    return 'Your backup way in when fingerprint or face unlock isn’t available.';
  }
  const name = biometry === 'touchId' ? 'Touch ID' : 'Face ID';
  return `Your backup way in when ${name} isn’t available.`;
}

export const EASY_PIN_WARNING = 'This PIN is easy to guess.';

/**
 * One digit repeated, or a straight run up or down (123456, 654321). Only a
 * soft warning: the owner may use it anyway (handover §11.15).
 */
export function isEasyPin(pin: string): boolean {
  if (!/^\d{2,}$/.test(pin)) return false;
  const digits = [...pin].map(Number);
  const steps = new Set(digits.slice(1).map((digit, index) => digit - digits[index]));
  return steps.size === 1 && [0, 1, -1].includes([...steps][0]);
}
