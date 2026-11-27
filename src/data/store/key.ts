import * as Crypto from 'expo-crypto';

import { t } from '@/i18n';
import vault, { isKeyLocked } from '@modules/expo-vault';

import {
  DATABASE_FILE_ENTRY,
  DATABASE_KEY_ENTRY,
  DEFAULT_DATABASE_NAME,
  MAIN_INDEX_FILE,
} from './constants';
import { keyError, listingError, nameError, unreadableKey } from './errors';
import { isRestoredName, mainIndexFiles } from './files';

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function vaultEntries(): Promise<string[]> {
  try {
    return await vault.getAllKeys();
  } catch (error) {
    throw listingError(error);
  }
}

// Never generate a new key while any index file exists, or the existing index becomes permanently unreadable.
export async function loadDatabaseKey(): Promise<string> {
  const keys = await vaultEntries();
  if (keys.includes(DATABASE_KEY_ENTRY)) {
    let existing: string;
    try {
      existing = await vault.get(DATABASE_KEY_ENTRY);
    } catch (error) {
      throw unreadableKey(error);
    }
    if (/^[0-9a-f]{64}$/i.test(existing)) return existing;
    throw unreadableKey(new Error('The stored database key is malformed.'));
  }
  if (mainIndexFiles().length > 0) {
    throw keyError('DATABASE_KEY_MISSING', t('errors.index.keyMissing'));
  }
  const key = toHex(Crypto.getRandomBytes(32));
  await vault.put(DATABASE_KEY_ENTRY, key);
  return key;
}

type IndexName = { name: string; guessed: boolean };

export async function currentDatabaseName(): Promise<IndexName> {
  let cause: unknown;
  try {
    const name = await vault.get(DATABASE_FILE_ENTRY);
    if (MAIN_INDEX_FILE.test(name)) return { name, guessed: false };
    cause = new Error('The stored index name is malformed.');
  } catch (error) {
    // Never fall back to the default name while the device key is locked.
    if (isKeyLocked(error)) throw unreadableKey(error);
    cause = error;
  }
  const listed = (await vaultEntries()).includes(DATABASE_FILE_ENTRY);
  if (mainIndexFiles().some(isRestoredName)) {
    throw nameError(listed ? cause : new Error('A restored index has no stored name.'));
  }
  return { name: DEFAULT_DATABASE_NAME, guessed: listed };
}
