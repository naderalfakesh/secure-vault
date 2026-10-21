import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { PrivacyCover } from '@/components/ui';

import { useSession } from './SessionProvider';

/**
 * How long the cover stays after returning to a vault that locked while away:
 * a native sheet that was open is still animating away above the lock screen.
 */
export const LOCK_HANDOFF_MS = 800;

/**
 * Privacy cover: hides the app behind a solid cover (never a blur, which can
 * leak the shapes of documents) while it is inactive (app switcher, incoming
 * call) and blocks screenshots and screen recording while unlocked. Both
 * follow the "Privacy cover" setting; the lock screen itself needs neither.
 *
 * On iOS the cover is drawn in a full-window overlay, which react-native-screens
 * adds to the key window when it mounts, so it sits above native modals and
 * sheets that are already presented, not beneath them.
 */
export function SecurityOverlay() {
  const { status, settings } = useSession();
  const enabled = settings.privacyScreen && status === 'unlocked';
  const [obscured, setObscured] = useState(AppState.currentState !== 'active');
  // Set when the vault locks behind the cover; lifted shortly after the return.
  const [handoff, setHandoff] = useState(false);
  const [lastStatus, setLastStatus] = useState(status);

  // The vault locked while the cover was up: keep it through the return.
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status === 'locked' && lastStatus === 'unlocked' && obscured && settings.privacyScreen) {
      setHandoff(true);
    }
  }

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [enabled]);

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

  const visible = settings.privacyScreen && ((enabled && obscured) || handoff);
  if (!visible) return null;

  return Platform.OS === 'ios' ? (
    <FullWindowOverlay>
      <PrivacyCover />
    </FullWindowOverlay>
  ) : (
    <PrivacyCover />
  );
}
