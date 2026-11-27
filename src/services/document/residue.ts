import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

import { removeNoFollow } from '../removeNoFollow';
import { appleTemporary, bestEffort, sweepAppleTemporary } from './appleTemp';
import {
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
  toPath,
  toUri,
} from './helpers';

export { discardSystemImportCopy } from './appleTemp';

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
  bestEffort(() => {
    const copy = new File(toUri(uri));
    if (copy.exists) copy.delete();
  });
}

export function discardImportCopy(cacheUri: string, path: string): void {
  let name: string | null;
  try {
    const cache = comparablePath(cacheUri).replace(/\/?$/, '/');
    name = childName(comparablePath(path), cache);
  } catch {
    return;
  }
  if (!name || !IMPORT_COPY.test(name)) return;
  bestEffort(() => removeNoFollow(new File(cacheUri, name)));
}

export function discardTemp(cacheUri: string, sourcePath: string, originalUri: string) {
  if (sourcePath === toPath(originalUri) || !isCachePath(cacheUri, sourcePath)) return;
  bestEffort(() => {
    const tempFile = new File(toUri(sourcePath));
    if (tempFile.exists) tempFile.delete();
  });
}

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
  bestEffort(() => removeNoFollow(new Directory(cacheUri, folderName)));
}

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

export async function clearCache(cacheUri: string): Promise<void> {
  // Also clears disk cache from older builds prior to memory-only image caching.
  const images = Promise.all([
    Image.clearMemoryCache().catch(() => false),
    Image.clearDiskCache().catch(() => false),
  ]);
  bestEffort(() => {
    for (const entry of new Directory(cacheUri).list()) {
      if (isClearableCacheEntry(entry.name)) bestEffort(() => removeNoFollow(entry));
    }
  });
  sweepAppleTemporary();
  await images;
}
