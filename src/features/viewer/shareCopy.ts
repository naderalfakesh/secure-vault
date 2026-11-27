import { Platform } from 'react-native';

import { biometryName } from '@/features/auth/lockCopy';
import { scopedText, t } from '@/i18n';
import type { BiometryType } from '@modules/expo-vault';

export const shareText = scopedText('share');

export function confirmShareLabel(biometry: BiometryType): string {
  if (biometry === 'none') {
    return t(Platform.OS === 'ios' ? 'share.confirmPasscode' : 'share.confirmScreenLock');
  }
  return t('share.confirmBiometry', { biometry: biometryName(biometry) });
}
