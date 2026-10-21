import { Platform } from 'react-native';

import { biometryName } from '@/features/auth/lockCopy';

import type { BiometryType } from '../../../modules/expo-vault';

/**
 * The J5 Share strings (handover §6 J5, §7.4), keyed so a later string table
 * (§10.1, F17) can take them over unchanged.
 */
export const shareCopy = {
  'warning.title': 'Share a decrypted copy?',
  'warning.body':
    'Whoever gets this file can open it without your PIN. SecureVault removes its temporary copy when sharing ends, but it can’t control copies the other app keeps.',
  'warning.share': 'Share',
  'warning.cancel': 'Cancel',
  'warning.notConfirmed': 'Not confirmed, so nothing was shared.',
  'preparing.title': 'Preparing a copy',
  // The copy is the document's one stored file, decrypted in a single native
  // call, so there is no page-by-page count to show (verification note).
  'preparing.label': 'Decrypting the document',
  'preparing.cancel': 'Cancel',
  failed: 'Couldn’t prepare the file.',
  'interrupted.lead': 'SecureVault locked while you were sharing.',
  'interrupted.body': 'The temporary copy was removed. Share again if you still need to.',
  'interrupted.again': 'Share again',
} as const;

/**
 * "Confirm with Face ID" when Confirm before sharing is on (§7.4). Without
 * biometrics the prompt is the device passcode or screen lock.
 */
export function confirmShareLabel(biometry: BiometryType): string {
  if (biometry === 'none') {
    return Platform.OS === 'ios' ? 'Confirm with passcode' : 'Confirm with screen lock';
  }
  return `Confirm with ${biometryName(biometry)}`;
}
