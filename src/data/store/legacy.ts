import type { DocumentMetadata } from '@/types';
import vault, { isKeyLocked } from '@modules/expo-vault';

import { LEGACY_IMPORTED_ENTRY, LEGACY_INDEX_ENTRY } from './constants';
import { unreadableKey } from './errors';

/** The prototype's JSON index, or null when there is none or it was already imported. */
export async function readLegacyIndex(): Promise<DocumentMetadata | null> {
  try {
    await vault.get(LEGACY_IMPORTED_ENTRY);
    return null;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
    // Not imported yet.
  }
  try {
    return JSON.parse(await vault.get(LEGACY_INDEX_ENTRY)) as DocumentMetadata;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
    return null;
  }
}

/** Records that the legacy index was imported, so later opens skip it. */
export async function markLegacyImported(): Promise<void> {
  await vault.put(LEGACY_IMPORTED_ENTRY, new Date().toISOString());
}
