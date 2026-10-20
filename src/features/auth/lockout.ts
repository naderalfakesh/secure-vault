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

/**
 * The longest pause a failure count can have earned: the one set when it last
 * crossed the threshold. Counts below it allow the base pause.
 */
export function longestPauseMs(failures: number): number {
  const escalation = Math.max(0, Math.floor(failures / LOCKOUT_THRESHOLD) - 1);
  return Math.min(LOCKOUT_BASE_MS * 2 ** escalation, LOCKOUT_MAX_MS);
}

/**
 * Caps a pause at the longest one its count can have earned from `now`, so a
 * clock moved back or a corrupt value cannot lock the keypad for good. Returns
 * the same object when nothing needed capping.
 */
export function clampLockout(state: LockoutState, now: number): LockoutState {
  const limit = now + longestPauseMs(state.failures);
  return state.lockedUntil > limit ? { ...state, lockedUntil: limit } : state;
}

/**
 * The stricter of two copies of the state, so neither a stale copy nor a lost
 * write hands back attempts, capped as in `clampLockout`.
 */
export function strictestLockout(a: LockoutState, b: LockoutState, now: number): LockoutState {
  return clampLockout(
    {
      failures: Math.max(a.failures, b.failures),
      lockedUntil: Math.max(a.lockedUntil, b.lockedUntil),
    },
    now,
  );
}

/**
 * Assumed when the stored state cannot be read or parsed: a base pause and no
 * invented failures, so a store that recovers is not left with a padded count.
 * The pause ends on its own, so a broken store slows guessing down without
 * ever keeping the owner out.
 */
export function unreadableLockout(now: number): LockoutState {
  return { failures: 0, lockedUntil: now + LOCKOUT_BASE_MS };
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
