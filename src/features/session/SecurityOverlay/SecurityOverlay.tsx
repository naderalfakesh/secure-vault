import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { PrivacyCover } from '@/components/ui';

import { useSessionState } from '../SessionProvider';
import { usePrivacyCover } from './usePrivacyCover';
import { useScreenCaptureBlock } from './useScreenCaptureBlock';

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
  const { status, settings } = useSessionState();
  useScreenCaptureBlock(settings.privacyScreen && status === 'unlocked');
  const visible = usePrivacyCover(status, settings.privacyScreen);

  if (!visible) return null;

  return Platform.OS === 'ios' ? (
    <FullWindowOverlay>
      <PrivacyCover />
    </FullWindowOverlay>
  ) : (
    <PrivacyCover />
  );
}
