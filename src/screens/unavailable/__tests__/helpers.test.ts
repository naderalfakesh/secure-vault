import { t } from '@/i18n';

import { pinLostHint } from '../helpers';

describe('pinLostHint', () => {
  it('names Face ID, Touch ID or the passcode on iOS', () => {
    expect(pinLostHint('faceId', 'ios')).toBe(t('unavailable.pinLost.hint.faceId'));
    expect(pinLostHint('touchId', 'ios')).toBe(t('unavailable.pinLost.hint.touchId'));
    expect(pinLostHint('none', 'ios')).toBe(t('unavailable.pinLost.hint.passcode'));
  });

  it('names biometrics or the screen lock on Android', () => {
    expect(pinLostHint('biometrics', 'android')).toBe(t('unavailable.pinLost.hint.biometrics'));
    expect(pinLostHint('none', 'android')).toBe(t('unavailable.pinLost.hint.screenLock'));
  });
});
