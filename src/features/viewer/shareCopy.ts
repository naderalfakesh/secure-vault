import { Platform } from 'react-native';

import { biometryName } from '@/features/auth/lockCopy';
import { scopedText, t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

/**
 * The Share strings. They live in the string table
 * under `share.`; this module keeps the short keys the share flow uses.
 */
export const shareText = scopedText('share');

/**
 * "Confirm with Face ID" when Confirm before sharing is on. Without
 * biometrics the prompt is the device passcode or screen lock.
 */
export function confirmShareLabel(biometry: BiometryType): string {
  if (biometry === 'none') {
    return t(Platform.OS === 'ios' ? 'share.confirmPasscode' : 'share.confirmScreenLock');
  }
  return t('share.confirmBiometry', { biometry: biometryName(biometry) });
}
