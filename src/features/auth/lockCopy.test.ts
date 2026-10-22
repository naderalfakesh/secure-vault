import { Platform } from 'react-native';

import {
  biometricKeyLabel,
  biometricSubtitle,
  deviceUnlockLabel,
  formatCountdown,
  wrongPinMessage,
} from './lockCopy';

function onAndroid(run: () => void) {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }
}

describe('lock copy', () => {
  it('formats the lockout countdown as m:ss', () => {
    expect(formatCountdown(28)).toBe('0:28');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(3600)).toBe('60:00');
    expect(formatCountdown(0.2)).toBe('0:01');
    expect(formatCountdown(-4)).toBe('0:00');
  });

  it('names the attempts left', () => {
    expect(wrongPinMessage(2)).toBe('Wrong PIN. 2 attempts left.');
    expect(wrongPinMessage(1)).toBe('Wrong PIN. 1 attempt left.');
  });

  it('names what the device prompt really accepts: biometrics or the passcode', () => {
    expect(deviceUnlockLabel('faceId')).toBe('Use Face ID or passcode');
    expect(deviceUnlockLabel('touchId')).toBe('Use Touch ID or passcode');
    expect(deviceUnlockLabel('none')).toBe('Use device passcode');
    expect(biometricSubtitle('faceId')).toBe('Use Face ID or enter your PIN');
    expect(biometricKeyLabel('faceId')).toBe('Unlock with Face ID');
  });

  it('never doubles "or" on Android', () => {
    onAndroid(() => {
      expect(biometricSubtitle('biometrics')).toBe('Use biometric unlock or enter your PIN');
      expect(deviceUnlockLabel('biometrics')).toBe('Use biometric unlock or screen lock');
      expect(deviceUnlockLabel('none')).toBe('Use screen lock');
      expect(biometricKeyLabel('biometrics')).toBe('Unlock with fingerprint or face');
      for (const text of [biometricSubtitle('biometrics'), deviceUnlockLabel('biometrics')]) {
        expect(text.split(' or ')).toHaveLength(2);
      }
    });
  });
});
