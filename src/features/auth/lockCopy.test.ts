import { formatCountdown, lockoutUnlockLabel, wrongPinMessage } from './lockCopy';

describe('lock copy', () => {
  it('formats the lockout countdown as m:ss', () => {
    expect(formatCountdown(28)).toBe('0:28');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(3600)).toBe('60:00');
    expect(formatCountdown(0.2)).toBe('0:01');
    expect(formatCountdown(-4)).toBe('0:00');
  });

  it('names the attempts left before a pause', () => {
    expect(wrongPinMessage(2)).toBe('Wrong PIN. 2 attempts left before a pause.');
    expect(wrongPinMessage(1)).toBe('Wrong PIN. 1 attempt left before a pause.');
  });

  it('keeps the device unlock on offer during a lockout', () => {
    expect(lockoutUnlockLabel('faceId')).toBe('Use Face ID or passcode');
    expect(lockoutUnlockLabel('none')).toBe('Use device passcode');
  });
});
