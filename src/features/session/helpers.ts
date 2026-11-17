import { type LockoutState, strictestLockout } from '@/features/auth/lockout';

import { DEFAULT_PAUSE_MAX_AWAY_MS, KEY_PROBE_ENTRY } from './constants';
import type { StoredRead } from './settings';
import type { AutoLockPause, KeyRead, PauseEntry, SessionStatus } from './types';

/**
 * The launch table: any read that failed is `unavailable`;
 * a key with a PIN is `locked`; anything else is setup, which keeps a key it
 * finds (Add a PIN).
 */
export function launchStatus(key: KeyRead, pin: KeyRead, orphaned = false): SessionStatus {
  if (orphaned || key === 'unreadable' || pin === 'unreadable') return 'unavailable';
  return key === 'present' && pin === 'present' ? 'locked' : 'setup';
}

/**
 * What the launch reads mean for the PIN record and the vault's entries. A PIN
 * record its marker says was written but that the store no longer returns is
 * `unreadable` (`pinLost`) while a device key exists; without a key, or with
 * `allowLostPin`, it is absent.
 */
export function interpretLaunchReads(
  key: KeyRead,
  pin: StoredRead<string>,
  entries: string[] | null,
  allowLostPin: boolean,
) {
  const lost = pin.state === 'unreadable' && pin.lost === true;
  const pinState: KeyRead = lost && (key === 'absent' || allowLostPin) ? 'absent' : pin.state;
  return {
    pin: pinState,
    pinLost: lost && key === 'present' && pinState === 'unreadable',
    entries: entries?.length ?? null,
    // Entries without the key that encrypted them: a new key cannot open them,
    // and setup over them would leave an index nobody can read. The key probe
    // alone is no document; setup overwrites it.
    orphaned: key === 'absent' && (entries ?? []).some((name) => name !== KEY_PROBE_ENTRY),
  };
}

/**
 * The lockout a PIN attempt is judged against. The stored copy outlives a
 * relaunch and the one in memory outlives a failed write; the attempt is
 * judged against the stricter of the two. An unreadable store (null) leaves
 * the one in memory.
 */
export function currentLockout(
  memory: LockoutState,
  stored: LockoutState | null,
  now: number,
): LockoutState {
  return strictestLockout(memory, stored ?? memory, now);
}

/** Whether time away has reached the auto-lock limit; -1 never locks. */
export function exceedsAutoLock(limitSeconds: number, awayMs: number): boolean {
  return limitSeconds >= 0 && awayMs >= limitSeconds * 1000;
}

/** A running pause for `pause`, with its defaults filled in. */
export function newPauseEntry(pause: AutoLockPause, startedAt: number): PauseEntry {
  return {
    maxAwayMs: pause.maxAwayMs ?? DEFAULT_PAUSE_MAX_AWAY_MS,
    endsOnReturn: pause.endsOnReturn ?? false,
    startedAt,
    awayAt: null,
  };
}

/** The last stop of the app when it happened while `entry` ran, or null. */
export function stoppedDuring(entry: PauseEntry, stoppedAt: number): number | null {
  return stoppedAt >= entry.startedAt ? stoppedAt : null;
}

/**
 * What a return to the foreground means for a pause that was away for
 * `awayMs`, given when the user left the app under it (`left`):
 * - `expired`: it outlived its bound; the whole time away is judged.
 * - `left`: the user left the app under it; the time since then is judged.
 * - `grace`: it ends on return; judged unless it settles within the grace.
 * - `excused`: it keeps running and the time away is excused.
 */
export function pauseReturnOutcome(
  entry: PauseEntry,
  awayMs: number,
  left: number | null,
): 'expired' | 'left' | 'grace' | 'excused' {
  if (awayMs > entry.maxAwayMs) return 'expired';
  if (left !== null) return 'left';
  return entry.endsOnReturn ? 'grace' : 'excused';
}

/**
 * How long a pause may stay away before it locks without waiting for the
 * return: past both its own limit and auto-lock.
 */
export function awayExpiryDelay(maxAwayMs: number, limitSeconds: number): number {
  return Math.max(maxAwayMs, limitSeconds * 1000) + 1;
}
