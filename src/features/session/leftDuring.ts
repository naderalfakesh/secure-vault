import vault from '@modules/expo-vault';

import { stoppedDuring } from './helpers';
import type { PauseEntry } from './types';

// Android's translucent share chooser only pauses the activity; a stop means the user left the app.
export function leftDuring(entry: PauseEntry): number | null {
  if (!entry.endsOnReturn) return null;
  let stoppedAt = 0;
  try {
    stoppedAt = vault.lastStoppedAt();
  } catch {}
  return stoppedDuring(entry, stoppedAt);
}
