import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';

import { loadAppearance } from '@/theme/appearance';

/** Keeps the native splash up until the launch is ready; call once, at module load. */
export function holdNativeSplash(): void {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Already hidden during a fast refresh; nothing to do.
  });
}

/**
 * The native splash and the handoff overlay that follows it. The stored
 * Appearance setting overrides the system theme, lock screen included. It is
 * read alongside the session, and the splash stays until both are in, so the
 * first frame is already in the chosen theme.
 */
export function useLaunchSplash(ready: boolean) {
  const [themed, setThemed] = useState(false);

  useEffect(() => {
    if (ready && themed) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, themed]);

  useEffect(() => {
    loadAppearance()
      .catch(() => {})
      .finally(() => setThemed(true));
  }, []);

  // The handoff repaints the native splash, then cross-fades out over the
  // lock screen, whose own mark is already in place.
  // While it runs, screens appear without a transition: the lock screen must
  // not slide in under the fading splash.
  const [handingOff, setHandingOff] = useState(true);
  const endHandoff = useCallback(() => setHandingOff(false), []);

  return { released: ready && themed, handingOff, endHandoff };
}
