import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { PrivacyCover } from '@/components/ui';

import { useSessionState } from '../SessionProvider';
import { usePrivacyCover } from './usePrivacyCover';
import { useScreenCaptureBlock } from './useScreenCaptureBlock';

// Solid cover (never a blur, which leaks shapes); FullWindowOverlay keeps iOS cover above modals.
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
