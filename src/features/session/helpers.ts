import { type LockoutState, strictestLockout } from '@/features/auth/lockout';

import { DEFAULT_PAUSE_MAX_AWAY_MS, KEY_PROBE_ENTRY } from './constants';
import type { StoredRead } from './settings';
import type { AutoLockPause, KeyRead, PauseEntry, SessionStatus } from './types';

export function launchStatus(key: KeyRead, pin: KeyRead, orphaned = false): SessionStatus {
  if (orphaned || key === 'unreadable' || pin === 'unreadable') return 'unavailable';
  return key === 'present' && pin === 'present' ? 'locked' : 'setup';
}

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
    // Entries without their key are unrecoverable; ignore the key probe entry alone.
    orphaned: key === 'absent' && (entries ?? []).some((name) => name !== KEY_PROBE_ENTRY),
  };
}

export function currentLockout(
  memory: LockoutState,
  stored: LockoutState | null,
  now: number,
): LockoutState {
  return strictestLockout(memory, stored ?? memory, now);
}

export function exceedsAutoLock(limitSeconds: number, awayMs: number): boolean {
  return limitSeconds >= 0 && awayMs >= limitSeconds * 1000;
}

export function newPauseEntry(pause: AutoLockPause, startedAt: number): PauseEntry {
  return {
    maxAwayMs: pause.maxAwayMs ?? DEFAULT_PAUSE_MAX_AWAY_MS,
    endsOnReturn: pause.endsOnReturn ?? false,
    startedAt,
    awayAt: null,
  };
}

export function stoppedDuring(entry: PauseEntry, stoppedAt: number): number | null {
  return stoppedAt >= entry.startedAt ? stoppedAt : null;
}

export function pauseReturnOutcome(
  entry: PauseEntry,
  awayMs: number,
  left: number | null,
): 'expired' | 'left' | 'grace' | 'excused' {
  if (awayMs > entry.maxAwayMs) return 'expired';
  if (left !== null) return 'left';
  return entry.endsOnReturn ? 'grace' : 'excused';
}

export function awayExpiryDelay(maxAwayMs: number, limitSeconds: number): number {
  return Math.max(maxAwayMs, limitSeconds * 1000) + 1;
}
