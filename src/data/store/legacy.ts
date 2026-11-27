import type { DocumentMetadata } from '@/types';
import vault, { isKeyLocked } from '@modules/expo-vault';

import { LEGACY_IMPORTED_ENTRY, LEGACY_INDEX_ENTRY } from './constants';
import { unreadableKey } from './errors';

export async function readLegacyIndex(): Promise<DocumentMetadata | null> {
  try {
    await vault.get(LEGACY_IMPORTED_ENTRY);
    return null;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
  }
  try {
    return JSON.parse(await vault.get(LEGACY_INDEX_ENTRY)) as DocumentMetadata;
  } catch (error) {
    if (isKeyLocked(error)) throw unreadableKey(error);
    return null;
  }
}

export async function markLegacyImported(): Promise<void> {
  await vault.put(LEGACY_IMPORTED_ENTRY, new Date().toISOString());
}
