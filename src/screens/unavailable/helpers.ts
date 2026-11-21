import { Platform } from 'react-native';

import type { SessionState } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

/** The device key's gate as this platform and phone name it. */
export function pinLostHint(
  biometry: SessionState['biometry'],
  os: typeof Platform.OS = Platform.OS,
): string {
  if (os === 'ios') {
    if (biometry === 'faceId') return t('unavailable.pinLost.hint.faceId');
    if (biometry === 'touchId') return t('unavailable.pinLost.hint.touchId');
    return t('unavailable.pinLost.hint.passcode');
  }
  return biometry === 'none'
    ? t('unavailable.pinLost.hint.screenLock')
    : t('unavailable.pinLost.hint.biometrics');
}
