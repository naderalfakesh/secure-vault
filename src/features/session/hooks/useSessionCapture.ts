import { type RefObject, useCallback } from 'react';
import { AppState } from 'react-native';

import type { AwayClock, SessionCapture, SessionStatus } from '../types';

type Options = {
  statusRef: RefObject<SessionStatus>;
  generationRef: RefObject<number>;
  waitersRef: RefObject<Set<() => void>>;
  away: RefObject<AwayClock>;
};

export function useSessionCapture({ statusRef, generationRef, waitersRef, away }: Options) {
  return useCallback((): SessionCapture => {
    const generation = statusRef.current === 'unlocked' ? generationRef.current : -1;
    const current = () => generation === generationRef.current && statusRef.current === 'unlocked';
    const confirm = () =>
      new Promise<boolean>((resolve) => {
        const settle = () => {
          if (!current()) {
            waitersRef.current.delete(settle);
            resolve(false);
          } else if (AppState.currentState === 'active' && away.current.backgroundedAt === null) {
            waitersRef.current.delete(settle);
            resolve(true);
          }
        };
        waitersRef.current.add(settle);
        settle();
      });
    const ended = () =>
      new Promise<void>((resolve) => {
        const settle = () => {
          if (current()) return;
          waitersRef.current.delete(settle);
          resolve();
        };
        waitersRef.current.add(settle);
        settle();
      });
    return { current, confirm, ended };
  }, [statusRef, generationRef, waitersRef, away]);
}
