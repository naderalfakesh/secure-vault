import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { BiometryType } from '../../../modules/expo-vault';
import { biometryName } from './lockCopy';
import { t } from '@/i18n';

/**
 * Why biometrics can or cannot be used (F13). `denied` is iOS only: the user
 * said no to SecureVault using Face ID. Android has no per-app biometric
 * permission, so there it is never reported. `noPasscode`: the phone has no
 * passcode or screen lock, so no biometric can be set up yet.
 */
export type BiometricState = 'available' | 'notEnrolled' | 'noPasscode' | 'denied' | 'unavailable';

export type BiometricAvailability = { state: BiometricState; kind: BiometryType };

const UNAVAILABLE: BiometricAvailability = { state: 'unavailable', kind: 'none' };

/**
 * Reads the biometric state from expo-local-authentication. On iOS a refused
 * Face ID permission looks like "not available" while the hardware type is
 * still reported, which is how it is told apart from a phone without it.
 */
export async function readBiometricAvailability(): Promise<BiometricAvailability> {
  const ios = Platform.OS === 'ios';
  try {
    const [hasHardware, enrolled, types, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
    // Android does not say which biometric is enrolled; "biometrics" keeps the copy honest.
    const kind: BiometryType = !ios
      ? 'biometrics'
      : types.includes(FACIAL_RECOGNITION)
        ? 'faceId'
        : types.includes(FINGERPRINT)
          ? 'touchId'
          : 'biometrics';
    // expo-local-authentication counts weak (class 2) biometrics as enrolled,
    // but the Android vault key accepts strong ones only, so weak face unlock
    // can never open it: nothing to offer there.
    if (!ios && enrolled && level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      return { state: 'unavailable', kind };
    }
    if (enrolled) return { state: 'available', kind };
    if (hasHardware && level === LocalAuthentication.SecurityLevel.NONE) {
      return { state: 'noPasscode', kind };
    }
    if (hasHardware) return { state: 'notEnrolled', kind };
    if (ios && types.length > 0) return { state: 'denied', kind };
    return { state: 'unavailable', kind };
  } catch {
    return UNAVAILABLE;
  }
}

/** The subtitle of a disabled biometric row, or null when there is nothing to explain. */
export function biometricUnavailableReason(availability: BiometricAvailability): string | null {
  const name = biometryName(availability.kind);
  if (availability.state === 'notEnrolled') {
    return Platform.OS === 'ios'
      ? t('onboarding.biometrics.notEnrolledIos', { biometry: name })
      : t('onboarding.biometrics.notEnrolledAndroid');
  }
  if (availability.state === 'noPasscode') {
    return Platform.OS === 'ios'
      ? t('onboarding.biometrics.noPasscodeIos', { biometry: name })
      : t('onboarding.biometrics.noPasscodeAndroid');
  }
  if (availability.state === 'denied') {
    return t('onboarding.biometrics.denied', { biometry: name });
  }
  return null;
}

/** Copy for the onboarding biometrics step. */
export function biometricStepCopy(kind: BiometryType): {
  title: string;
  body: string;
  action: string;
} {
  const rest = t('onboarding.biometrics.rest');
  if (Platform.OS !== 'ios') {
    return {
      title: t('onboarding.biometrics.titleAndroid'),
      body: t('onboarding.biometrics.bodyAndroid', { rest }),
      action: t('onboarding.biometrics.actionAndroid'),
    };
  }
  const name = biometryName(kind);
  return {
    title: t('onboarding.biometrics.title', { biometry: name }),
    body: t(
      kind === 'touchId' ? 'onboarding.biometrics.bodyTouch' : 'onboarding.biometrics.bodyGlance',
      { rest },
    ),
    action: t('onboarding.biometrics.action', { biometry: name }),
  };
}

/**
 * The current availability, read again whenever the app returns to the
 * foreground (the user may have enrolled or allowed it in the Settings app).
 * Null until the first read lands.
 */
export function useBiometricAvailability(): BiometricAvailability | null {
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const refresh = useCallback(() => {
    let current = true;
    readBiometricAvailability().then((next) => {
      if (current) setAvailability(next);
    });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    let cancel = refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      cancel();
      cancel = refresh();
    });
    return () => {
      cancel();
      subscription.remove();
    };
  }, [refresh]);
  return availability;
}
