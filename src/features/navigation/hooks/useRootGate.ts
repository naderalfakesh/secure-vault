import { useReducedMotion } from 'react-native-reanimated';

import { useLegacyScratchSweep } from '@/features/session/hooks/useLegacyScratchSweep';
import { useSessionToasts } from '@/features/session/hooks/useSessionToasts';
import { useVaultSweep } from '@/features/session/hooks/useVaultSweep';
import { useSessionState } from '@/features/session/SessionProvider';

import { useLaunchSplash } from '../launchSplash';
import { stackAnimation } from '../stackAnimation';
import { useReturnToShare } from './useReturnToShare';

export function useRootGate() {
  const { status, shareInterrupted } = useSessionState();
  const reduceMotion = useReducedMotion();
  const ready = status !== 'loading';

  useLegacyScratchSweep();
  const { released, handingOff, endHandoff } = useLaunchSplash(ready);

  useVaultSweep(status);
  useSessionToasts();
  useReturnToShare(status, shareInterrupted);

  return {
    status,
    ready,
    released,
    endHandoff,
    animation: stackAnimation(handingOff, reduceMotion),
  };
}
