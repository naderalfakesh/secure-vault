import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { removeNoFollow } from '../removeNoFollow';
import { APPLE_INBOX_DIRECTORY, SCAN_PAGE } from './constants';
import { comparablePath, renamedCopyPattern } from './helpers';

export function bestEffort(step: () => void): void {
  try {
    step();
  } catch {
    // Retried on next lock/launch sweep.
  }
}

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

// Matches exact filename or iOS Inbox collision renames ("scan 2.pdf", "scan-2.pdf").
export function discardSystemImportCopy(name: string): void {
  if (!name || name.includes('/') || name === '.' || name === '..') return;
  const inbox = appleInbox();
  if (!inbox) return;
  const renamed = renamedCopyPattern(name);
  bestEffort(() => {
    for (const entry of inbox.list()) {
      if (entry instanceof File && (entry.name === name || renamed.test(entry.name))) {
        entry.delete();
      }
    }
  });
}

export function sweepAppleTemporary(): void {
  const tmp = appleTemporary();
  if (!tmp) return;
  bestEffort(() => {
    const inbox = appleInbox();
    if (inbox) removeNoFollow(inbox);
  });
  bestEffort(() => {
    for (const entry of new Directory(tmp.uri).list()) {
      if (entry instanceof File && SCAN_PAGE.test(entry.name)) entry.delete();
    }
  });
}
