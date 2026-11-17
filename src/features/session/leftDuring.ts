import vault from '../../../modules/expo-vault';
import { stoppedDuring } from './helpers';
import type { PauseEntry } from './types';

/**
 * When the user left the app while `entry` ran, or null. Android's share
 * chooser is translucent and only pauses the activity; a stop means Home,
 * Recents, the screen turning off, or a target opened over the app. Its
 * result reaches the app only on the return, so this is the one sign of when
 * the user went away. iOS reports no stops: its sheet runs in-process.
 */
export function leftDuring(entry: PauseEntry): number | null {
  if (!entry.endsOnReturn) return null;
  let stoppedAt = 0;
  try {
    stoppedAt = vault.lastStoppedAt();
  } catch {
    // A build without the call: the return is judged as before.
  }
  return stoppedDuring(entry, stoppedAt);
}
