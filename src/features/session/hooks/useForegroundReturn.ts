import { type RefObject, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AUTO_LOCK_RETURN_GRACE_MS } from '../constants';
import { awayExpiryDelay, pauseReturnOutcome } from '../helpers';
import { leftDuring } from '../leftDuring';
import type { AwayClock, PauseEntry, SessionStatus } from '../types';

type Options = {
  statusRef: RefObject<SessionStatus>;
  away: RefObject<AwayClock>;
  autoLockRef: RefObject<number>;
  judgeAway: (awayMs: number) => void;
  settleWaiters: () => void;
  launch: () => Promise<SessionStatus>;
  resettingPinRef: RefObject<boolean>;
};

/**
 * Auto-lock: remember when the app left the foreground and compare on return.
 * While system UI pauses it, the time away is excused only within that
 * pause's limits, so a pause that never ends cannot keep the vault open.
 */
export function useForegroundReturn({
  statusRef,
  away,
  autoLockRef,
  judgeAway,
  settleWaiters,
  launch,
  resettingPinRef,
}: Options) {
  useEffect(() => {
    const clock = away.current;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // A pause still pending once the time away passes both its own limit and
    // auto-lock locks then, without waiting for the return: Android's chooser
    // keeps the app away for as long as it stays up, and the copy it offers
    // must not outlive the session. Locking sweeps the copy, so a target picked
    // later reads nothing.
    const expireWhileAway = (entry: PauseEntry) => {
      const limit = autoLockRef.current;
      const awayAt = entry.awayAt;
      if (limit < 0 || awayAt === null) return;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          // Back in the meantime, or the pause ended: that trip is judged as before.
          if (entry.awayAt !== awayAt || !clock.pauses.delete(entry)) return;
          judgeAway(Date.now() - awayAt);
          settleWaiters();
        },
        awayExpiryDelay(entry.maxAwayMs, limit),
      );
      timers.add(timer);
    };
    const onChange = (next: AppStateStatus) => {
      // Vault unavailable: try once more on each return to the foreground.
      if (statusRef.current === 'unavailable') {
        if (next === 'active' && !resettingPinRef.current) void launch();
        return;
      }
      const pauses = clock.pauses;
      if (statusRef.current === 'unlocked' && pauses.size === 0) {
        if (next === 'background' || next === 'inactive') {
          if (clock.backgroundedAt === null) clock.pauseEndedAway = false;
          clock.backgroundedAt ??= Date.now();
        } else if (next === 'active' && clock.backgroundedAt !== null) {
          const idleMs = Date.now() - clock.backgroundedAt;
          const endedOnTheWayBack = clock.pauseEndedAway && idleMs < AUTO_LOCK_RETURN_GRACE_MS;
          clock.backgroundedAt = null;
          clock.pauseEndedAway = false;
          // A picker result that lands just before the app is active again
          // (Android) is part of coming back, not time away.
          if (!endedOnTheWayBack) judgeAway(idleMs);
        }
      } else if (statusRef.current === 'unlocked') {
        const now = Date.now();
        for (const entry of [...pauses]) {
          if (next === 'background' || next === 'inactive') {
            if (entry.awayAt === null) {
              entry.awayAt = now;
              expireWhileAway(entry);
            }
            continue;
          }
          if (next !== 'active' || entry.awayAt === null) continue;
          const awayMs = now - entry.awayAt;
          entry.awayAt = null;
          const left = leftDuring(entry);
          const outcome = pauseReturnOutcome(entry, awayMs, left);
          if (outcome === 'expired') {
            pauses.delete(entry);
            judgeAway(awayMs);
          } else if (outcome === 'left' && left !== null) {
            // The user left the app under the chooser: the time since is away time.
            pauses.delete(entry);
            judgeAway(now - left);
          } else if (outcome === 'grace') {
            const timer = setTimeout(() => {
              timers.delete(timer);
              // Still pending: the system UI never showed, or is gone without settling.
              if (pauses.delete(entry)) {
                judgeAway(awayMs);
                settleWaiters();
              }
            }, AUTO_LOCK_RETURN_GRACE_MS);
            timers.add(timer);
          }
        }
      }
      // Waiting work resumes only after the return to the foreground was judged.
      settleWaiters();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
      timers.forEach(clearTimeout);
    };
  }, [statusRef, away, autoLockRef, judgeAway, settleWaiters, launch, resettingPinRef]);
}
