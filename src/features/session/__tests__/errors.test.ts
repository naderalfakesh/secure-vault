import { t } from '@/i18n';
import { KEY_INVALIDATED_MESSAGE } from '@/utils/errors';

import { describeError, errorCode, KEY_NOT_UNLOCKED, keyNotUnlocked } from '../errors';

describe('describeError', () => {
  it('says what a cancelled key prompt means where it happened', () => {
    const locked = { code: 'KEY_LOCKED' };
    expect(describeError(locked, 'fallback')).toBe(KEY_NOT_UNLOCKED);
    expect(describeError(locked, 'fallback', 'setup')).toBe(keyNotUnlocked.setup);
    expect(describeError(locked, 'fallback', 'changePin')).toBe(keyNotUnlocked.changePin);
  });

  it('offers the PIN after a refused Face ID only on the lock screen', () => {
    const refused = { code: 'BIOMETRIC_AUTH_FAILED' };
    expect(describeError(refused, 'fallback', 'resetPin')).toBe(keyNotUnlocked.resetPin);
    expect(describeError(refused, 'fallback')).toBe(t('session.biometricFailed'));
  });

  it('replaces known native codes, then keeps the message, then falls back', () => {
    expect(describeError({ code: 'KEY_INVALIDATED' }, 'fallback')).toBe(KEY_INVALIDATED_MESSAGE);
    expect(describeError(new Error('The OS said no'), 'fallback')).toBe('The OS said no');
    expect(describeError(new Error(''), 'fallback')).toBe('fallback');
    expect(describeError('nope', 'fallback')).toBe('fallback');
  });
});

describe('errorCode', () => {
  it('reads the code of an object and nothing else', () => {
    expect(errorCode({ code: 'X' })).toBe('X');
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode('X')).toBeUndefined();
  });
});
