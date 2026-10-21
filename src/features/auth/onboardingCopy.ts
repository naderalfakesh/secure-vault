import { Platform } from 'react-native';

import { t } from '@/i18n';

import type { BiometryType } from '../../../modules/expo-vault';

/** Intro step 3 (handover §7.5), worded for the biometric this phone has. */
export function unlockSlideBody(biometry: BiometryType): string {
  const rest = t('onboarding.intro.3.rest');
  if (Platform.OS !== 'ios') {
    return biometry === 'none'
      ? t('onboarding.intro.3.screenLock', { rest })
      : t('onboarding.intro.3.fingerprintOrFace', { rest });
  }
  if (biometry === 'faceId') return t('onboarding.intro.3.faceId', { rest });
  if (biometry === 'touchId') return t('onboarding.intro.3.touchId', { rest });
  if (biometry === 'biometrics') return t('onboarding.intro.3.faceOrTouchId', { rest });
  return t('onboarding.intro.3.passcode', { rest });
}

/** The Choose PIN subtitle. */
export function choosePinHint(biometry: BiometryType): string {
  if (biometry === 'none') {
    // Android calls it the screen lock; "passcode" is the iOS word.
    return Platform.OS === 'ios'
      ? t('onboarding.pin.hintPasscode')
      : t('onboarding.pin.hintScreenLock');
  }
  if (Platform.OS !== 'ios') return t('onboarding.pin.hintAndroid');
  const name = biometry === 'touchId' ? t('lock.touchId') : t('lock.faceId');
  return t('onboarding.pin.hintBiometry', { biometry: name });
}

export const EASY_PIN_WARNING = t('onboarding.pin.easy');

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
