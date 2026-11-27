import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { removeNoFollow } from '../removeNoFollow';
import { APPLE_INBOX_DIRECTORY, SCAN_PAGE } from './constants';
import { comparablePath, renamedCopyPattern } from './helpers';

/** Runs a cleanup step whose failure changes nothing: a later sweep retries it. */
export function bestEffort(step: () => void): void {
  try {
    step();
  } catch {
    // Left for the next lock or launch sweep.
  }
}

/**
 * The app container's tmp folder on iOS, the sibling of Documents; null on
 * Android or when the container does not have the expected layout.
 */
export function appleTemporary(): { uri: string; path: string } | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const documentsUri = Paths.document.uri.replace(/\/?$/, '/');
    if (!documentsUri.endsWith('/Documents/')) return null;
    const uri = `${documentsUri.slice(0, -'Documents/'.length)}tmp/`;
    const path = comparablePath(uri);
    const container = path.slice(0, -'tmp/'.length);
    if (!comparablePath(Paths.cache.uri).startsWith(container)) return null;
    return { uri, path };
  } catch {
    return null;
  }
}

function appleInbox(): Directory | null {
  const tmp = appleTemporary();
  return tmp ? new Directory(`${tmp.uri}${APPLE_INBOX_DIRECTORY}/`) : null;
}

/**
 * Removes iOS's Inbox copy of a file just picked from Files. Only a file
 * directly in the app's own Inbox qualifies, named exactly as picked or as
 * the system renames a copy whose name is taken: a space or a hyphen and a
 * number before the extension ("scan 2.pdf" for "scan.pdf"). Everything in
 * that folder is a plaintext import copy, and the lock and launch sweep
 * removes the whole folder anyway.
 */
export function discardSystemImportCopy(name: string): void {
  if (!name || name.includes('/') || name === '.' || name === '..') return;
  const inbox = appleInbox();
  if (!inbox) return;
  const renamed = renamedCopyPattern(name);
  // The lock and launch sweep removes the Inbox folder.
  bestEffort(() => {
    for (const entry of inbox.list()) {
      if (entry instanceof File && (entry.name === name || renamed.test(entry.name))) {
        entry.delete();
      }
    }
  });
}

/** iOS's Inbox copies and the scanner's pages left in tmp by a kill or a crash. */
export function sweepAppleTemporary(): void {
  const tmp = appleTemporary();
  if (!tmp) return;
  bestEffort(() => {
    const inbox = appleInbox();
    if (inbox) removeNoFollow(inbox);
  });
  // tmp may not exist yet.
  bestEffort(() => {
    for (const entry of new Directory(tmp.uri).list()) {
      if (entry instanceof File && SCAN_PAGE.test(entry.name)) entry.delete();
    }
  });
}
