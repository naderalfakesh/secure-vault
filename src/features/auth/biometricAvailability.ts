import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

import { biometryName } from './lockCopy';

type BiometricState = 'available' | 'notEnrolled' | 'noPasscode' | 'denied' | 'unavailable';

export type BiometricAvailability = { state: BiometricState; kind: BiometryType };

const UNAVAILABLE: BiometricAvailability = { state: 'unavailable', kind: 'none' };

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
    const kind: BiometryType = !ios
      ? 'biometrics'
      : types.includes(FACIAL_RECOGNITION)
        ? 'faceId'
        : types.includes(FINGERPRINT)
          ? 'touchId'
          : 'biometrics';
    // Android vault key requires strong (Class 3) biometrics; ignore weak (Class 2) enrollment.
    if (!ios && enrolled && level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      return { state: 'unavailable', kind };
    }
    if (enrolled) return { state: 'available', kind };
    if (hasHardware && level === LocalAuthentication.SecurityLevel.NONE) {
      return { state: 'noPasscode', kind };
    }
    if (hasHardware) return { state: 'notEnrolled', kind };
    // iOS refused Face ID permission reports !hasHardware while still listing hardware types.
    if (ios && types.length > 0) return { state: 'denied', kind };
    return { state: 'unavailable', kind };
  } catch {
    return UNAVAILABLE;
  }
}

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
