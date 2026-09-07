import {
  attemptsLeft,
  EMPTY_LOCKOUT,
  isLocked,
  LOCKOUT_BASE_MS,
  LOCKOUT_MAX_MS,
  lockRemainingMs,
  recordFailure,
  sanitizeLockout,
} from './lockout';

describe('lockout', () => {
  const now = 1_000_000;

  it('locks on the fifth failure and doubles each time up to an hour', () => {
    let state = EMPTY_LOCKOUT;
    for (let i = 0; i < 4; i += 1) state = recordFailure(state, now);
    expect(isLocked(state, now)).toBe(false);
    expect(attemptsLeft(state)).toBe(1);

    state = recordFailure(state, now);
    expect(lockRemainingMs(state, now)).toBe(LOCKOUT_BASE_MS);

    const later = state.lockedUntil + 1;
    for (let i = 0; i < 5; i += 1) state = recordFailure(state, later);
    expect(lockRemainingMs(state, later)).toBe(LOCKOUT_BASE_MS * 2);

    for (let round = 0; round < 10; round += 1) {
      const t = state.lockedUntil + 1;
      for (let i = 0; i < 5; i += 1) state = recordFailure(state, t);
    }
    expect(lockRemainingMs(state, state.lockedUntil - LOCKOUT_MAX_MS)).toBe(LOCKOUT_MAX_MS);
  });

  it('ignores failures while locked', () => {
    let state = EMPTY_LOCKOUT;
    for (let i = 0; i < 5; i += 1) state = recordFailure(state, now);
    const locked = state;
    expect(recordFailure(locked, now + 1)).toBe(locked);
  });

  it('sanitizes persisted garbage', () => {
    expect(sanitizeLockout(null)).toEqual(EMPTY_LOCKOUT);
    expect(sanitizeLockout({ failures: -3, lockedUntil: 'x' })).toEqual(EMPTY_LOCKOUT);
    expect(sanitizeLockout({ failures: 2, lockedUntil: 5 })).toEqual({
      failures: 2,
      lockedUntil: 5,
    });
  });
});
