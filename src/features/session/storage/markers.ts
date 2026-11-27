import { Directory, File, Paths } from 'expo-file-system';

import { excludeFromBackupQuietly } from '@/services/removeNoFollow';

// Android expo-secure-store silently deletes undecryptable entries and returns null;
// non-secret marker files distinguish a lost record from an absent one.
export const SESSION_MARKER_DIRECTORY = 'securevault-session';
export const PIN_MARKER = 'pin';
export const LOCKOUT_MARKER = 'lockout';

const markerDirectory = () => new Directory(Paths.document, SESSION_MARKER_DIRECTORY);
const markerFile = (name: string) => new File(markerDirectory(), name);

export const hasMarker = (name: string) => markerFile(name).exists;

export function markWritten(name: string) {
  try {
    const file = markerFile(name);
    if (!file.exists) file.create({ intermediates: true });
    // Exclude from iCloud/iTunes backup so a restored device doesn't inherit orphan markers.
    excludeFromBackupQuietly(markerDirectory());
  } catch {
    // Repaired by the next read that finds the record.
  }
}

export function removeMarker(name: string) {
  const file = markerFile(name);
  if (file.exists) file.delete();
  if (file.exists) throw new Error(`The ${name} marker could not be removed.`);
}
