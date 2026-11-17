import { EMPTY_LOCKOUT } from '@/features/auth/lockout';

import { DEFAULT_PAUSE_MAX_AWAY_MS, KEY_PROBE_ENTRY } from '../constants';
import {
  awayExpiryDelay,
  currentLockout,
  exceedsAutoLock,
  interpretLaunchReads,
  launchStatus,
  newPauseEntry,
  pauseReturnOutcome,
  stoppedDuring,
} from '../helpers';

describe('launchStatus', () => {
  it('locks a vault with a key and a PIN', () => {
    expect(launchStatus('present', 'present')).toBe('locked');
  });

  it('goes to setup when either is missing, keeping a key it finds', () => {
    expect(launchStatus('absent', 'absent')).toBe('setup');
    expect(launchStatus('present', 'absent')).toBe('setup');
    expect(launchStatus('absent', 'present')).toBe('setup');
  });

  it('is unavailable when a read failed or entries lost their key', () => {
    expect(launchStatus('unreadable', 'present')).toBe('unavailable');
    expect(launchStatus('present', 'unreadable')).toBe('unavailable');
    expect(launchStatus('absent', 'absent', true)).toBe('unavailable');
  });
});

describe('interpretLaunchReads', () => {
  const lostPin = { state: 'unreadable', lost: true } as const;

  it('passes a readable PIN record through and counts the entries', () => {
    expect(
      interpretLaunchReads('present', { state: 'present', value: 'h' }, ['a', 'b'], false),
    ).toEqual({ pin: 'present', pinLost: false, entries: 2, orphaned: false });
  });

  it('reports a lost PIN record while the key is there', () => {
    expect(interpretLaunchReads('present', lostPin, [], false)).toEqual({
      pin: 'unreadable',
      pinLost: true,
      entries: 0,
      orphaned: false,
    });
  });

  it('treats a lost PIN as absent without a key, or once its reset was allowed', () => {
    expect(interpretLaunchReads('absent', lostPin, [], false).pin).toBe('absent');
    const allowed = interpretLaunchReads('present', lostPin, [], true);
    expect(allowed.pin).toBe('absent');
    expect(allowed.pinLost).toBe(false);
  });

  it('keeps a PIN the store refused to read unreadable, never lost', () => {
    const read = interpretLaunchReads('present', { state: 'unreadable' }, [], true);
    expect(read.pin).toBe('unreadable');
    expect(read.pinLost).toBe(false);
  });

  it('marks entries without their key as orphaned, ignoring the key probe', () => {
    const absent = { state: 'absent' } as const;
    expect(interpretLaunchReads('absent', absent, ['doc'], false).orphaned).toBe(true);
    expect(interpretLaunchReads('absent', absent, [KEY_PROBE_ENTRY], false).orphaned).toBe(false);
    expect(interpretLaunchReads('present', absent, ['doc'], false).orphaned).toBe(false);
  });

  it('leaves the entry count unknown when the listing failed', () => {
    const read = interpretLaunchReads('absent', { state: 'absent' }, null, false);
    expect(read.entries).toBeNull();
    expect(read.orphaned).toBe(false);
  });
});

describe('currentLockout', () => {
  const now = 1_000_000;

  it('takes the stricter of the copy in memory and the stored one', () => {
    const memory = { failures: 3, lockedUntil: 0 };
    const stored = { failures: 5, lockedUntil: now + 30_000 };
    expect(currentLockout(memory, stored, now)).toEqual(stored);
    expect(currentLockout(stored, memory, now)).toEqual(stored);
  });

  it('keeps the copy in memory when the store could not be read', () => {
    const memory = { failures: 2, lockedUntil: 0 };
    expect(currentLockout(memory, null, now)).toEqual(memory);
    expect(currentLockout(EMPTY_LOCKOUT, null, now)).toEqual(EMPTY_LOCKOUT);
  });
});

describe('exceedsAutoLock', () => {
  it('locks at the limit, immediately for 0, and never for -1', () => {
    expect(exceedsAutoLock(60, 59_999)).toBe(false);
    expect(exceedsAutoLock(60, 60_000)).toBe(true);
    expect(exceedsAutoLock(0, 0)).toBe(true);
    expect(exceedsAutoLock(-1, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('pauses', () => {
  it('fills in the default bound and starts away from nothing', () => {
    expect(newPauseEntry({}, 5)).toEqual({
      maxAwayMs: DEFAULT_PAUSE_MAX_AWAY_MS,
      endsOnReturn: false,
      startedAt: 5,
      awayAt: null,
    });
    expect(newPauseEntry({ maxAwayMs: 10, endsOnReturn: true }, 5)).toMatchObject({
      maxAwayMs: 10,
      endsOnReturn: true,
    });
  });

  it('counts a stop only when it happened after the pause began', () => {
    const entry = newPauseEntry({ endsOnReturn: true }, 100);
    expect(stoppedDuring(entry, 99)).toBeNull();
    expect(stoppedDuring(entry, 100)).toBe(100);
    expect(stoppedDuring(entry, 0)).toBeNull();
  });

  it('judges a return by the bound first, then a stop, then how the pause ends', () => {
    const share = newPauseEntry({ maxAwayMs: 1000, endsOnReturn: true }, 0);
    const picker = newPauseEntry({ maxAwayMs: 1000 }, 0);
    expect(pauseReturnOutcome(share, 1001, 50)).toBe('expired');
    expect(pauseReturnOutcome(share, 1000, 50)).toBe('left');
    expect(pauseReturnOutcome(share, 1000, null)).toBe('grace');
    expect(pauseReturnOutcome(picker, 1000, null)).toBe('excused');
  });

  it('expires a pause left away past both its bound and auto-lock', () => {
    expect(awayExpiryDelay(120_000, 60)).toBe(120_001);
    expect(awayExpiryDelay(1000, 300)).toBe(300_001);
    expect(awayExpiryDelay(1000, 0)).toBe(1001);
  });
});
