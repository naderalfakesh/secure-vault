/**
 * PIN lockout policy. Pure and serializable so it can be unit-tested and
 * persisted: a relaunch must not hand an attacker a fresh set of attempts.
 *
 * Every fifth consecutive failure locks the keypad, and each lock lasts twice
 * as long as the previous one (30 s, 60 s, 120 s, ...) up to an hour. A
 * successful unlock resets everything.
 */
export interface LockoutState {
  /** Consecutive failed attempts since the last successful unlock. */
  failures: number;
  /** Epoch ms until which the keypad is locked; 0 when not locked. */
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

/** Attempts left before the next lock kicks in. */
export function attemptsLeft(state: LockoutState): number {
  return LOCKOUT_THRESHOLD - (state.failures % LOCKOUT_THRESHOLD);
}

export function recordFailure(state: LockoutState, now: number): LockoutState {
  // Entries while locked are ignored by the UI; guard anyway so a stray call
  // cannot extend the lock.
  if (isLocked(state, now)) return state;
  const failures = state.failures + 1;
  if (failures % LOCKOUT_THRESHOLD !== 0) return { failures, lockedUntil: 0 };
  const escalation = failures / LOCKOUT_THRESHOLD - 1;
  const duration = Math.min(LOCKOUT_BASE_MS * 2 ** escalation, LOCKOUT_MAX_MS);
  return { failures, lockedUntil: now + duration };
}

/** Coerces whatever was persisted into a valid state. */
export function sanitizeLockout(value: unknown): LockoutState {
  if (!value || typeof value !== 'object') return EMPTY_LOCKOUT;
  const { failures, lockedUntil } = value as Partial<LockoutState>;
  return {
    failures: Number.isInteger(failures) && (failures as number) >= 0 ? (failures as number) : 0,
    lockedUntil:
      Number.isFinite(lockedUntil) && (lockedUntil as number) > 0 ? (lockedUntil as number) : 0,
  };
}
