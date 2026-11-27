import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';

import { loadAppearance } from '@/theme/appearance';

export function holdNativeSplash(): void {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

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

  // Suppress stack transitions during handoff so the lock screen doesn't slide in under the splash.
  const [handingOff, setHandingOff] = useState(true);
  const endHandoff = useCallback(() => setHandingOff(false), []);

  return { released: ready && themed, handingOff, endHandoff };
}
