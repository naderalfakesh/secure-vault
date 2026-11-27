import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { SessionStatus } from '../SessionProvider';
import { LOCK_HANDOFF_MS } from './constants';

export function usePrivacyCover(status: SessionStatus, privacyScreen: boolean): boolean {
  const enabled = privacyScreen && status === 'unlocked';
  const [obscured, setObscured] = useState(AppState.currentState !== 'active');
  const [handoff, setHandoff] = useState(false);
  const [lastStatus, setLastStatus] = useState(status);

  // Keep the cover briefly after return if the vault locked behind it.
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status === 'locked' && lastStatus === 'unlocked' && obscured && privacyScreen) {
      setHandoff(true);
    }
  }

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setObscured(next !== 'active');
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!handoff || obscured) return;
    const timer = setTimeout(() => setHandoff(false), LOCK_HANDOFF_MS);
    return () => clearTimeout(timer);
  }, [handoff, obscured]);

  return privacyScreen && ((enabled && obscured) || handoff);
}
