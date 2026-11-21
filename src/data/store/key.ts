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

/**
 * Key hierarchy: the device key (a Keychain item on iOS, a non-exportable
 * Keystore key on Android) is used only inside the vault module; it encrypts
 * this random database key, which SQLCipher uses for every page of the index.
 * Losing the device key loses both.
 *
 * A new key is only written when the entry is absent from the vault's listing
 * (which needs no device key) and no index file of any name exists. Writing
 * one in any other case would make an existing index unreadable for good.
 */
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
  // Any main index file, not only `name`, which may be the default guessed for an unreadable one.
  if (mainIndexFiles().length > 0) {
    throw keyError('DATABASE_KEY_MISSING', t('errors.index.keyMissing'));
  }
  const key = toHex(Crypto.getRandomBytes(32));
  await vault.put(DATABASE_KEY_ENTRY, key);
  return key;
}

type IndexName = { name: string; guessed: boolean };

/**
 * The index file in use; restores switch to a fresh file instead of reusing
 * the name. A vault that never stored a name uses the default, unless a
 * restored index exists: then a restore moved its file but failed to record
 * the name. A stored name that cannot be read is only replaced by the default
 * when no restored index exists, and that guess is `guessed`.
 */
export async function currentDatabaseName(): Promise<IndexName> {
  let cause: unknown;
  try {
    const name = await vault.get(DATABASE_FILE_ENTRY);
    if (MAIN_INDEX_FILE.test(name)) return { name, guessed: false };
    cause = new Error('The stored index name is malformed.');
  } catch (error) {
    // A locked key says nothing about the name; guessing would point at the wrong file.
    if (isKeyLocked(error)) throw unreadableKey(error);
    cause = error;
  }
  const listed = (await vaultEntries()).includes(DATABASE_FILE_ENTRY);
  if (mainIndexFiles().some(isRestoredName)) {
    throw nameError(listed ? cause : new Error('A restored index has no stored name.'));
  }
  return { name: DEFAULT_DATABASE_NAME, guessed: listed };
}
