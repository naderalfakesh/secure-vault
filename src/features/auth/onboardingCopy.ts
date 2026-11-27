import { Platform } from 'react-native';

import { t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

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

export function choosePinHint(biometry: BiometryType): string {
  if (biometry === 'none') {
    return Platform.OS === 'ios'
      ? t('onboarding.pin.hintPasscode')
      : t('onboarding.pin.hintScreenLock');
  }
  if (Platform.OS !== 'ios') return t('onboarding.pin.hintAndroid');
  const name = biometry === 'touchId' ? t('lock.touchId') : t('lock.faceId');
  return t('onboarding.pin.hintBiometry', { biometry: name });
}

export const EASY_PIN_WARNING = t('onboarding.pin.easy');

export function isEasyPin(pin: string): boolean {
  if (!/^\d{2,}$/.test(pin)) return false;
  const digits = [...pin].map(Number);
  const steps = new Set(digits.slice(1).map((digit, index) => digit - (digits[index] ?? digit)));
  const [step] = steps;
  return steps.size === 1 && step !== undefined && [0, 1, -1].includes(step);
}
