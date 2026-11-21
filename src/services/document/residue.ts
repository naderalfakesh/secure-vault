import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

import { removeNoFollow } from '../removeNoFollow';
import {
  APPLE_INBOX_DIRECTORY,
  IMPORT_COPY,
  IMPORT_DIRECTORIES,
  LEGACY_ANDROID_CACHE,
  LEGACY_ANDROID_FILES,
  LEGACY_APPLE_TMP,
  PREVIEW_FOLDER,
  SCAN_PAGE,
} from './constants';
import {
  childName,
  comparablePath,
  isCachePath,
  isClearableCacheEntry,
  renamedCopyPattern,
  toPath,
  toUri,
} from './helpers';

/** Runs a cleanup step whose failure changes nothing: a later sweep retries it. */
function bestEffort(step: () => void): void {
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
function appleTemporary(): { uri: string; path: string } | null {
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

/**
 * Removes a picker's or the scanner's plaintext copy of a picked file. Only
 * a file directly inside one of their cache folders, or an iOS scanner page
 * directly in tmp, qualifies; anything else, `..` paths included, is the
 * user's own file and is left alone.
 */
export function discardPickedCopy(uri: string): void {
  let path: string;
  let cache: string;
  try {
    path = comparablePath(uri);
    cache = comparablePath(Paths.cache.uri).replace(/\/?$/, '/');
  } catch {
    return;
  }
  const tmp = appleTemporary();
  const inImportFolder = IMPORT_DIRECTORIES.some(
    (directory) => childName(path, `${cache}${directory}`) !== null,
  );
  const scanPage = tmp !== null && SCAN_PAGE.test(childName(path, tmp.path) ?? '');
  if (!inImportFolder && !scanPage) return;
  // The lock and launch sweep removes these folders and pages.
  bestEffort(() => {
    const copy = new File(toUri(uri));
    if (copy.exists) copy.delete();
  });
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
function sweepAppleTemporary(): void {
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

/**
 * Removes `getLocalFilePath`'s plaintext copy of a `content://` file. Only an
 * entry named exactly `temp_import_<digits>` directly in the cache
 * qualifies; a picked file's own path is left alone.
 */
export function discardImportCopy(cacheUri: string, path: string): void {
  let name: string | null;
  try {
    const cache = comparablePath(cacheUri).replace(/\/?$/, '/');
    name = childName(comparablePath(path), cache);
  } catch {
    return;
  }
  if (!name || !IMPORT_COPY.test(name)) return;
  // The lock and launch sweep removes these copies.
  bestEffort(() => removeNoFollow(new File(cacheUri, name)));
}

export function discardTemp(cacheUri: string, sourcePath: string, originalUri: string) {
  if (sourcePath === toPath(originalUri) || !isCachePath(cacheUri, sourcePath)) return;
  // Cache files are also swept by clearCache.
  bestEffort(() => {
    const tempFile = new File(toUri(sourcePath));
    if (tempFile.exists) tempFile.delete();
  });
}

/**
 * Removes the folder `previewForFile` rendered a PDF preview into. Only a
 * file directly in a `pages_preview_<time>` folder directly in the cache
 * qualifies; a photo's own URI and the viewer's pages are left alone.
 */
export function discardPreview(cacheUri: string, uri: string): void {
  let path: string;
  let cache: string;
  try {
    path = comparablePath(uri);
    cache = comparablePath(cacheUri).replace(/\/?$/, '/');
  } catch {
    return;
  }
  const folder = path.slice(0, path.lastIndexOf('/'));
  const folderName = childName(folder, cache);
  if (!folderName || !PREVIEW_FOLDER.test(folderName) || childName(path, folder) === null) return;
  // Swept by clearCache.
  bestEffort(() => removeNoFollow(new Directory(cacheUri, folderName)));
}

/**
 * Launch-only sweep of scratch files older builds left: iOS `tmp/backup-<UUID>`
 * and `tmp/<UUID>`, Android `cacheDir/backup*.tmp` and `filesDir/vault*.tmp`.
 * Only plain files directly in those folders with exactly those names go.
 */
export function sweepLegacyScratch(cacheUri: string): void {
  const sweep = (uri: string, matches: (name: string) => boolean) => {
    bestEffort(() => {
      for (const entry of new Directory(uri).list()) {
        if (entry instanceof File && matches(entry.name)) entry.delete();
      }
    });
  };
  if (Platform.OS === 'ios') {
    const tmp = appleTemporary();
    if (tmp) sweep(tmp.uri, (name) => LEGACY_APPLE_TMP.some((pattern) => pattern.test(name)));
  } else if (Platform.OS === 'android') {
    sweep(cacheUri, (name) => LEGACY_ANDROID_CACHE.test(name));
    sweep(Paths.document.uri, (name) => LEGACY_ANDROID_FILES.test(name));
  }
}

/** Remove every decrypted file from the cache directory, and every image the image library cached. */
export async function clearCache(cacheUri: string): Promise<void> {
  // The disk sweep also removes copies an older build wrote to the image
  // library's disk cache (iOS kept full decrypted pages there).
  const images = Promise.all([
    Image.clearMemoryCache().catch(() => false),
    Image.clearDiskCache().catch(() => false),
  ]);
  // The cache directory may not exist yet, and the OS also purges it.
  bestEffort(() => {
    for (const entry of new Directory(cacheUri).list()) {
      if (isClearableCacheEntry(entry.name)) bestEffort(() => removeNoFollow(entry));
    }
  });
  sweepAppleTemporary();
  await images;
}
