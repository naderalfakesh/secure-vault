import { useReducedMotion } from 'react-native-reanimated';

import { useLegacyScratchSweep } from '@/features/session/hooks/useLegacyScratchSweep';
import { useSessionToasts } from '@/features/session/hooks/useSessionToasts';
import { useVaultSweep } from '@/features/session/hooks/useVaultSweep';
import { useSessionState } from '@/features/session/SessionProvider';

import { useLaunchSplash } from '../launchSplash';
import { stackAnimation } from '../stackAnimation';
import { useReturnToShare } from './useReturnToShare';

/**
 * Everything the root navigator needs besides its screens: the session's
 * status for the guards, the launch splash, and the work that follows a lock
 * or an unlock.
 */
export function useRootGate() {
  const { status, shareInterrupted } = useSessionState();
  // Reduced motion: screens cross-fade instead of sliding.
  const reduceMotion = useReducedMotion();
  const ready = status !== 'loading';

  useLegacyScratchSweep();
  const { released, handingOff, endHandoff } = useLaunchSplash(ready);

  // Every decrypted preview, rendered page, and share copy goes when the
  // vault locks, whichever path locked it, and at a launch that does not
  // land on the lock screen.
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
