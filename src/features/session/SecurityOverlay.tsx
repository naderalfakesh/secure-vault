import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { PrivacyCover } from '@/components/ui';

import { useSession } from './SessionProvider';

/**
 * Privacy cover: hides the app behind a solid cover (never a blur, which can
 * leak the shapes of documents) while it is inactive (app switcher, incoming
 * call) and blocks screenshots and screen recording while unlocked. Both
 * follow the "Privacy cover" setting; the lock screen itself needs neither.
 */
export function SecurityOverlay() {
  const { status, settings } = useSession();
  const enabled = settings.privacyScreen && status === 'unlocked';
  const [obscured, setObscured] = useState(false);

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

  if (!enabled || !obscured) return null;

  return <PrivacyCover />;
}
