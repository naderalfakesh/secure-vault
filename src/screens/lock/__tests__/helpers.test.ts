import { biometricSubtitle, LOCKOUT_BODY, wrongPinMessage } from '@/features/auth/lockCopy';
import { t } from '@/i18n';

import { type LockMessageInput, lockMessage, secondsLeft } from '../helpers';

const base: LockMessageInput = {
  lockLeft: 0,
  wrong: false,
  error: null,
  attemptsLeft: 4,
  hasBiometrics: false,
  biometry: 'none',
  pinLength: 0,
};

describe('secondsLeft', () => {
  it('rounds up to whole seconds', () => {
    expect(secondsLeft(0)).toBe(0);
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(1000)).toBe(1);
    expect(secondsLeft(29_001)).toBe(30);
  });

  it('stays at or below zero once the lockout has passed', () => {
    expect(secondsLeft(-500)).toBeLessThanOrEqual(0);
  });
});

describe('lockMessage', () => {
  it('asks for the PIN by default', () => {
    expect(lockMessage(base)).toEqual({
      lockedOut: false,
      alerting: false,
      title: t('lock.title'),
      subtitle: t('lock.enterPin'),
    });
  });

  it('names the biometrics before any digit is entered', () => {
    const input = { ...base, hasBiometrics: true, biometry: 'faceId' as const };
    expect(lockMessage(input).subtitle).toBe(biometricSubtitle('faceId'));
    expect(lockMessage({ ...input, pinLength: 2 }).subtitle).toBe(t('lock.enterPin'));
  });

  it('reports a wrong PIN with the attempts left', () => {
    const message = lockMessage({ ...base, wrong: true, error: 'ignored' });
    expect(message.alerting).toBe(true);
    expect(message.subtitle).toBe(wrongPinMessage(4));
  });

  it('shows a session error when the PIN was not wrong', () => {
    const message = lockMessage({ ...base, error: 'Key unreadable' });
    expect(message.alerting).toBe(true);
    expect(message.subtitle).toBe('Key unreadable');
  });

  it('puts a lockout before a wrong PIN or an error', () => {
    const message = lockMessage({ ...base, lockLeft: 28, wrong: true, error: 'x' });
    expect(message).toEqual({
      lockedOut: true,
      alerting: false,
      title: t('lock.lockoutTitle', { time: '0:28' }),
      subtitle: LOCKOUT_BODY,
    });
  });
});
