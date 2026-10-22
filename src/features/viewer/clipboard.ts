import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

/** How long iOS keeps copied document text on the clipboard. */
export const COPIED_TEXT_EXPIRY_MS = 2 * 60_000;

/**
 * The last copy this session made, as a digest so the text itself is not kept
 * in memory a second time, with the time iOS removes it on its own.
 */
let copied: { digest: string; expiresAt: number } | null = null;

const digestOf = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));

function options(expiresAt: number): Clipboard.SetStringOptions {
  return {
    // Not offered to the user's other devices through Universal Clipboard,
    // and removed by the system once it expires.
    ios: { localOnly: true, expiresAt: new Date(expiresAt) },
    // No clipboard preview overlay or keyboard suggestion shows the text.
    android: { isSensitive: true },
  };
}

/** Copies a document's text with the platform's privacy options. */
export async function copySensitiveText(text: string, now = Date.now()): Promise<void> {
  const expiresAt = now + COPIED_TEXT_EXPIRY_MS;
  await Clipboard.setStringAsync(text, options(expiresAt));
  copied = { digest: digestOf(text), expiresAt };
}

/**
 * Called when the vault locks: empties the clipboard when it still holds the
 * text this session copied, and leaves anything copied since alone. Resolves
 * true when it cleared it. Never throws; the clipboard may be unreadable while
 * the app is in the background.
 */
export async function clearCopiedText(now = Date.now()): Promise<boolean> {
  const mine = copied;
  copied = null;
  if (!mine) return false;
  // iOS has removed it already; reading now would only meet someone else's copy.
  if (Platform.OS === 'ios' && now >= mine.expiresAt) return false;
  try {
    const current = await Clipboard.getStringAsync();
    if (!current || digestOf(current) !== mine.digest) return false;
    await Clipboard.setStringAsync('', options(now + COPIED_TEXT_EXPIRY_MS));
    return true;
  } catch {
    return false;
  }
}
