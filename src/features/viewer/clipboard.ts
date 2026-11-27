import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

import vault from '@modules/expo-vault';

export const COPIED_TEXT_EXPIRY_MS = 2 * 60_000;

let copied: { stamp: string | null; expiresAt: number } | null = null;

// localOnly blocks Universal Clipboard; isSensitive hides Android clipboard preview.
function options(expiresAt: number): Clipboard.SetStringOptions {
  return {
    ios: { localOnly: true, expiresAt: new Date(expiresAt) },
    android: { isSensitive: true },
  };
}

function currentStamp(): string | null {
  try {
    return vault.clipboardStamp();
  } catch {
    return null;
  }
}

export async function copySensitiveText(text: string, now = Date.now()): Promise<void> {
  const expiresAt = now + COPIED_TEXT_EXPIRY_MS;
  await Clipboard.setStringAsync(text, options(expiresAt));
  copied = { stamp: currentStamp(), expiresAt };
}

// Compare change stamp without reading clipboard content (avoids iOS paste prompt / Android toast).
export async function clearCopiedText(now = Date.now()): Promise<boolean> {
  const mine = copied;
  copied = null;
  if (!mine || mine.stamp === null) return false;
  if (Platform.OS === 'ios' && now >= mine.expiresAt) return false;
  if (currentStamp() !== mine.stamp) return false;
  try {
    await Clipboard.setStringAsync('', options(now + COPIED_TEXT_EXPIRY_MS));
    return true;
  } catch {
    return false;
  }
}
