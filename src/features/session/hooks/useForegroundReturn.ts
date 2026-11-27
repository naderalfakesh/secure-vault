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
    // Lock while still backgrounded once a pause outlives its bound and auto-lock so shared temp files are swept.
    const expireWhileAway = (entry: PauseEntry) => {
      const limit = autoLockRef.current;
      const awayAt = entry.awayAt;
      if (limit < 0 || awayAt === null) return;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          if (entry.awayAt !== awayAt || !clock.pauses.delete(entry)) return;
          judgeAway(Date.now() - awayAt);
          settleWaiters();
        },
        awayExpiryDelay(entry.maxAwayMs, limit),
      );
      timers.add(timer);
    };
    const onChange = (next: AppStateStatus) => {
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
          // Android picker results can arrive just before AppState transitions to active.
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
            pauses.delete(entry);
            judgeAway(now - left);
          } else if (outcome === 'grace') {
            const timer = setTimeout(() => {
              timers.delete(timer);
              if (pauses.delete(entry)) {
                judgeAway(awayMs);
                settleWaiters();
              }
            }, AUTO_LOCK_RETURN_GRACE_MS);
            timers.add(timer);
          }
        }
      }
      settleWaiters();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
      timers.forEach(clearTimeout);
    };
  }, [statusRef, away, autoLockRef, judgeAway, settleWaiters, launch, resettingPinRef]);
}
