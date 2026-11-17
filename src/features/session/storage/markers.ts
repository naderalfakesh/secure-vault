import { Directory, File, Paths } from 'expo-file-system';

import { excludeFromBackupQuietly } from '@/services/removeNoFollow';

/**
 * expo-secure-store on Android deletes an entry it can no longer decrypt
 * ("out of sync with the keystore") and returns null, so a missing record
 * alone does not prove none was written. Each record therefore has a plain,
 * non-secret marker file next to the vault's entries, written after the
 * record and removed before it: a marker without its record means the record
 * was lost, never that there is none. The markers hold no data, and their
 * names are not vault entry names, so the vault's listing, backups and
 * restores never see them.
 */
export const SESSION_MARKER_DIRECTORY = 'securevault-session';
export const PIN_MARKER = 'pin';
export const LOCKOUT_MARKER = 'lockout';

const markerDirectory = () => new Directory(Paths.document, SESSION_MARKER_DIRECTORY);
const markerFile = (name: string) => new File(markerDirectory(), name);

/** Whether the marker exists; throws when that cannot be told. */
export const hasMarker = (name: string) => markerFile(name).exists;

/**
 * Writes the marker after its record was stored. A failure is left for the
 * next read of the record to repair, so it never fails the write it follows.
 */
export function markWritten(name: string) {
  try {
    const file = markerFile(name);
    if (!file.exists) file.create({ intermediates: true });
    // Never in an iCloud or iTunes backup: a restored phone has no markers
    // and reads its records alone, as before markers existed.
    excludeFromBackupQuietly(markerDirectory());
  } catch {
    // Repaired by the next read that finds the record.
  }
}

/** Removes the marker before its record goes; throws when it stays. */
export function removeMarker(name: string) {
  const file = markerFile(name);
  if (file.exists) file.delete();
  if (file.exists) throw new Error(`The ${name} marker could not be removed.`);
}
