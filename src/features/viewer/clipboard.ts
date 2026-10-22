import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

import vault from '../../../modules/expo-vault';

/** How long iOS keeps copied document text on the clipboard. */
export const COPIED_TEXT_EXPIRY_MS = 2 * 60_000;

/**
 * The last copy this session made: the clipboard's change stamp right after
 * it (never the text), and the time iOS removes it on its own.
 */
let copied: { stamp: string | null; expiresAt: number } | null = null;

function options(expiresAt: number): Clipboard.SetStringOptions {
  return {
    // Not offered to the user's other devices through Universal Clipboard,
    // and removed by the system once it expires.
    ios: { localOnly: true, expiresAt: new Date(expiresAt) },
    // No clipboard preview overlay or keyboard suggestion shows the text.
    android: { isSensitive: true },
  };
}

/** The clipboard's change stamp, or null when it cannot be told. */
function currentStamp(): string | null {
  try {
    return vault.clipboardStamp();
  } catch {
    return null;
  }
}

/** Copies a document's text with the platform's privacy options. */
export async function copySensitiveText(text: string, now = Date.now()): Promise<void> {
  const expiresAt = now + COPIED_TEXT_EXPIRY_MS;
  await Clipboard.setStringAsync(text, options(expiresAt));
  copied = { stamp: currentStamp(), expiresAt };
}

/**
 * Called when the vault locks: empties the clipboard when nothing was copied
 * since this session's copy, judged by the clipboard's change stamp alone.
 * The content is never read, so iOS shows no paste prompt and Android no
 * "pasted" toast, and another app's newer copy is left alone. When the stamp
 * cannot be told, the clipboard is left as it is. Resolves true when it
 * cleared it; never throws.
 */
export async function clearCopiedText(now = Date.now()): Promise<boolean> {
  const mine = copied;
  copied = null;
  if (!mine || mine.stamp === null) return false;
  // iOS has removed it already.
  if (Platform.OS === 'ios' && now >= mine.expiresAt) return false;
  if (currentStamp() !== mine.stamp) return false;
  try {
    await Clipboard.setStringAsync('', options(now + COPIED_TEXT_EXPIRY_MS));
    return true;
  } catch {
    return false;
  }
}
