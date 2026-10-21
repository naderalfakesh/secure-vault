import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import {
  biometricStepCopy,
  biometricUnavailableReason,
  readBiometricAvailability,
} from './biometricAvailability';

function onAndroid<T>(run: () => T): T {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  try {
    return run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }
}

function device(hasHardware: boolean, enrolled: boolean, types: number[]) {
  jest.spyOn(LocalAuthentication, 'hasHardwareAsync').mockResolvedValue(hasHardware);
  jest.spyOn(LocalAuthentication, 'isEnrolledAsync').mockResolvedValue(enrolled);
  jest
    .spyOn(LocalAuthentication, 'supportedAuthenticationTypesAsync')
    .mockResolvedValue(types as LocalAuthentication.AuthenticationType[]);
}

const FACE = 2;
const FINGER = 1;

describe('biometric availability', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is available with an enrolled Face ID or Touch ID', async () => {
    device(true, true, [FACE]);
    await expect(readBiometricAvailability()).resolves.toEqual({
      state: 'available',
      kind: 'faceId',
    });
    device(true, true, [FINGER]);
    await expect(readBiometricAvailability()).resolves.toEqual({
      state: 'available',
      kind: 'touchId',
    });
  });

  it('tells a phone without enrolled biometrics apart from one that refused SecureVault', async () => {
    device(true, false, [FACE]);
    await expect(readBiometricAvailability()).resolves.toEqual({
      state: 'notEnrolled',
      kind: 'faceId',
    });
    // iOS reports Face ID hardware but "not available" once the user said no.
    device(false, false, [FACE]);
    await expect(readBiometricAvailability()).resolves.toEqual({
      state: 'denied',
      kind: 'faceId',
    });
  });

  it('is unavailable without hardware or when the check fails', async () => {
    device(false, false, []);
    await expect(readBiometricAvailability()).resolves.toMatchObject({ state: 'unavailable' });
    jest.spyOn(LocalAuthentication, 'hasHardwareAsync').mockRejectedValue(new Error('boom'));
    await expect(readBiometricAvailability()).resolves.toMatchObject({ state: 'unavailable' });
  });

  it('never reports a refusal on Android, which has no per-app biometric permission', async () => {
    device(false, false, [FINGER]);
    const result = await onAndroid(() => readBiometricAvailability());
    expect(result).toEqual({ state: 'unavailable', kind: 'biometrics' });
    device(true, false, [FINGER, FACE]);
    await expect(onAndroid(() => readBiometricAvailability())).resolves.toEqual({
      state: 'notEnrolled',
      kind: 'biometrics',
    });
  });

  it('gives the reason a disabled Face ID row shows', () => {
    expect(biometricUnavailableReason({ state: 'notEnrolled', kind: 'faceId' })).toBe(
      'Face ID isn’t set up on this phone. Set it up in the Settings app, then come back.',
    );
    expect(biometricUnavailableReason({ state: 'denied', kind: 'faceId' })).toBe(
      'SecureVault isn’t allowed to use Face ID. You can allow it in Settings.',
    );
    expect(biometricUnavailableReason({ state: 'available', kind: 'faceId' })).toBeNull();
    expect(
      onAndroid(() => biometricUnavailableReason({ state: 'notEnrolled', kind: 'biometrics' })),
    ).toBe('Fingerprint or face unlock isn’t set up on this phone.');
  });

  it('words the onboarding step for the biometric on this phone', () => {
    expect(biometricStepCopy('faceId')).toEqual({
      title: 'Unlock with Face ID?',
      body: 'Open the vault with a glance. Your PIN still works, and you can change this in Settings.',
      action: 'Use Face ID',
    });
    expect(biometricStepCopy('touchId').action).toBe('Use Touch ID');
    expect(onAndroid(() => biometricStepCopy('biometrics'))).toEqual({
      title: 'Unlock with fingerprint or face?',
      body: 'Open the vault without typing your PIN. Your PIN still works, and you can change this in Settings.',
      action: 'Use fingerprint or face',
    });
  });
});
