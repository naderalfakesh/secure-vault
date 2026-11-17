import { type RefObject, useCallback } from 'react';
import { AppState } from 'react-native';

import { exceedsAutoLock, newPauseEntry } from '../helpers';
import { leftDuring } from '../leftDuring';
import type { AutoLockPause, AwayClock, SessionStatus } from '../types';
import { useForegroundReturn } from './useForegroundReturn';

type Options = {
  statusRef: RefObject<SessionStatus>;
  changeStatus: (next: SessionStatus) => void;
  settleWaiters: () => void;
  away: RefObject<AwayClock>;
  autoLockRef: RefObject<number>;
  launch: () => Promise<SessionStatus>;
  resettingPinRef: RefObject<boolean>;
};

/**
 * Auto-lock: time away from the app is judged against the limit on the way
 * back, and `withoutAutoLock` pauses it for system UI within that pause's
 * limits, so a pause that never ends cannot keep the vault open.
 */
export function useAutoLock({
  statusRef,
  changeStatus,
  settleWaiters,
  away,
  autoLockRef,
  launch,
  resettingPinRef,
}: Options) {
  /** Locks when time away has passed the auto-lock limit. */
  const judgeAway = useCallback(
    (awayMs: number) => {
      if (statusRef.current === 'unlocked' && exceedsAutoLock(autoLockRef.current, awayMs)) {
        changeStatus('locked');
      }
    },
    [statusRef, autoLockRef, changeStatus],
  );

  const withoutAutoLock = useCallback(
    async <T>(work: () => Promise<T>, pause: AutoLockPause = {}) => {
      const entry = newPauseEntry(pause, Date.now());
      const clock = away.current;
      clock.pauses.add(entry);
      try {
        return await work();
      } finally {
        if (clock.pauses.delete(entry)) {
          const awayAt = entry.awayAt;
          if (AppState.currentState === 'active' || awayAt === null) {
            clock.backgroundedAt = null;
          } else if (Date.now() - awayAt > entry.maxAwayMs) {
            // Ended while still away after outliving its bound (Android delivers
            // a chooser's Back or pick before the app is active again, and its
            // paused timers never fired): the pause excuses nothing, so the whole
            // trip since the app left under it is judged now, and again on
            // return if auto-lock allows it so far.
            clock.backgroundedAt = awayAt;
            clock.pauseEndedAway = false;
            judgeAway(Date.now() - awayAt);
          } else {
            const left = leftDuring(entry);
            if (left !== null) {
              // Android: the user left the app under the chooser (Home, or a
              // target opened over it), and its result only arrives with the
              // return. The pause excused the time until then; from then on the
              // user was simply away, judged without the return grace.
              clock.backgroundedAt = left;
              clock.pauseEndedAway = false;
              judgeAway(Date.now() - left);
            } else {
              // Ended while still away within its bound (iOS handed the share to
              // another app, or a picker result landed on the way back): the pause
              // excused the time until now, and the rest of the time away is
              // judged on return like any other.
              clock.backgroundedAt = Date.now();
              clock.pauseEndedAway = true;
            }
          }
        }
        settleWaiters();
      }
    },
    [away, settleWaiters, judgeAway],
  );

  useForegroundReturn({
    statusRef,
    away,
    autoLockRef,
    judgeAway,
    settleWaiters,
    launch,
    resettingPinRef,
  });

  return { withoutAutoLock };
}
