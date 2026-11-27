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

export function useAutoLock({
  statusRef,
  changeStatus,
  settleWaiters,
  away,
  autoLockRef,
  launch,
  resettingPinRef,
}: Options) {
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
            // Pause outlived its bound while away: judge the full trip since backgrounding.
            clock.backgroundedAt = awayAt;
            clock.pauseEndedAway = false;
            judgeAway(Date.now() - awayAt);
          } else {
            const left = leftDuring(entry);
            if (left !== null) {
              // Android: user left the app under the chooser; judge time away since then.
              clock.backgroundedAt = left;
              clock.pauseEndedAway = false;
              judgeAway(Date.now() - left);
            } else {
              // Pause ended within its bound while still away: start normal away timer now.
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
