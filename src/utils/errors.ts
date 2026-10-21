import { isKeyLocked } from '../../modules/expo-vault/src/withKeyRecovery';

/** The index's own sentence for a device key that was not unlocked (see `src/data/database.ts`). */
export const KEY_LOCKED_MESSAGE =
  'The device key was not unlocked, so your documents stay closed. Try again.';

export const KEY_INVALIDATED_MESSAGE =
  "This device's screen lock or biometrics changed, so the vault key can no longer be used. The documents already in this vault cannot be opened on this device.";

/**
 * A sentence for a failed vault call that a screen can show as is. A device
 * key prompt that was cancelled, or a Keystore window that lapsed, reaches
 * here as the platform's own text ("User not authenticated"); it never
 * reaches the user that way.
 */
export function plainErrorMessage(error: unknown, fallback: string): string {
  if (isKeyLocked(error)) return KEY_LOCKED_MESSAGE;
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  if (code === 'KEY_INVALIDATED') return KEY_INVALIDATED_MESSAGE;
  return error instanceof Error && error.message ? error.message : fallback;
}
