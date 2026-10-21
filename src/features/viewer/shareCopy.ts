import { Platform } from 'react-native';

import { biometryName } from '@/features/auth/lockCopy';
import { type StringKey, t } from '@/i18n';
import type { share } from '@/i18n/en/share';

import type { BiometryType } from '../../../modules/expo-vault';

/**
 * The J5 Share strings (handover §6 J5, §7.4). They live in the string table
 * under `share.`; this module keeps the short keys the share flow uses.
 */
export type ShareCopyKey = {
  [K in keyof typeof share]: K extends `share.${infer Key}` ? Key : never;
}[keyof typeof share];

export function shareText(key: ShareCopyKey): string {
  return t(`share.${key}` as StringKey);
}

/**
 * "Confirm with Face ID" when Confirm before sharing is on (§7.4). Without
 * biometrics the prompt is the device passcode or screen lock.
 */
export function confirmShareLabel(biometry: BiometryType): string {
  if (biometry === 'none') {
    return t(Platform.OS === 'ios' ? 'share.confirmPasscode' : 'share.confirmScreenLock');
  }
  return t('share.confirmBiometry', { biometry: biometryName(biometry) });
}
