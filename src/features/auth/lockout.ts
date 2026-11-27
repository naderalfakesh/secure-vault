export interface LockoutState {
  failures: number;
  lockedUntil: number;
}

export const EMPTY_LOCKOUT: LockoutState = { failures: 0, lockedUntil: 0 };

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MS = 30_000;
export const LOCKOUT_MAX_MS = 60 * 60_000;

export function isLocked(state: LockoutState, now: number): boolean {
  return state.lockedUntil > now;
}

export function lockRemainingMs(state: LockoutState, now: number): number {
  return Math.max(0, state.lockedUntil - now);
}

export function secondsLeft(remainingMs: number): number {
  return Math.ceil(remainingMs / 1000);
}

export function attemptsLeft(state: LockoutState): number {
  return LOCKOUT_THRESHOLD - (state.failures % LOCKOUT_THRESHOLD);
}

export function recordFailure(state: LockoutState, now: number): LockoutState {
  if (isLocked(state, now)) return state;
  const failures = state.failures + 1;
  if (failures % LOCKOUT_THRESHOLD !== 0) return { failures, lockedUntil: 0 };
  const escalation = failures / LOCKOUT_THRESHOLD - 1;
  const duration = Math.min(LOCKOUT_BASE_MS * 2 ** escalation, LOCKOUT_MAX_MS);
  return { failures, lockedUntil: now + duration };
}

export function longestPauseMs(failures: number): number {
  const escalation = Math.max(0, Math.floor(failures / LOCKOUT_THRESHOLD) - 1);
  return Math.min(LOCKOUT_BASE_MS * 2 ** escalation, LOCKOUT_MAX_MS);
}

// Cap pause at what this failure count earned so a backward clock jump cannot lock forever.
export function clampLockout(state: LockoutState, now: number): LockoutState {
  const limit = now + longestPauseMs(state.failures);
  return state.lockedUntil > limit ? { ...state, lockedUntil: limit } : state;
}

export function strictestLockout(a: LockoutState, b: LockoutState, now: number): LockoutState {
  return clampLockout(
    {
      failures: Math.max(a.failures, b.failures),
      lockedUntil: Math.max(a.lockedUntil, b.lockedUntil),
    },
    now,
  );
}

// Base pause with 0 failures so an unreadable store slows guessing without padding the count.
export function unreadableLockout(now: number): LockoutState {
  return { failures: 0, lockedUntil: now + LOCKOUT_BASE_MS };
}

export function sanitizeLockout(value: unknown): LockoutState {
  if (!value || typeof value !== 'object') return EMPTY_LOCKOUT;
  const { failures, lockedUntil } = value as Partial<LockoutState>;
  return {
    failures: Number.isInteger(failures) && (failures as number) >= 0 ? (failures as number) : 0,
    lockedUntil:
      Number.isFinite(lockedUntil) && (lockedUntil as number) > 0 ? (lockedUntil as number) : 0,
  };
}
