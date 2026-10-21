import { Platform } from 'react-native';

import { choosePinHint, isEasyPin, unlockSlideBody } from './onboardingCopy';

function onAndroid<T>(run: () => T): T {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  try {
    return run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }
}

describe('onboarding copy', () => {
  it('names the biometric on intro step 3', () => {
    expect(unlockSlideBody('faceId')).toBe(
      'Face ID opens the vault. A 6-digit PIN is always there as a backup, and the vault locks itself when you leave.',
    );
    expect(unlockSlideBody('touchId')).toMatch(/^Touch ID opens the vault\./);
    expect(unlockSlideBody('none')).toMatch(/^Your device passcode opens the vault\./);
    expect(onAndroid(() => unlockSlideBody('biometrics'))).toMatch(
      /^Your fingerprint or face opens the vault\./,
    );
    expect(onAndroid(() => unlockSlideBody('none'))).toMatch(/^Your screen lock opens the vault\./);
  });

  it('says what the PIN is for', () => {
    expect(choosePinHint('faceId')).toBe('Your backup way in when Face ID isn’t available.');
    expect(onAndroid(() => choosePinHint('biometrics'))).toBe(
      'Your backup way in when fingerprint or face unlock isn’t available.',
    );
    expect(choosePinHint('none')).toBe(
      'You’ll use it with your device passcode to open the vault.',
    );
  });

  it('flags repeated digits and straight runs as easy to guess', () => {
    for (const pin of ['000000', '111111', '123456', '654321', '012345', '987654']) {
      expect(isEasyPin(pin)).toBe(true);
    }
    for (const pin of ['123459', '120399', '845201', '112233']) {
      expect(isEasyPin(pin)).toBe(false);
    }
  });
});
