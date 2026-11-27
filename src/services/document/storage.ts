import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import ExpoVaultModule from '@modules/expo-vault';

import {
  decryptedName,
  decryptedPageName,
  pdfPagesName,
  SHARE_DIRECTORY,
  thumbnailName,
} from './cacheNames';
import { PAGE_MAX_PIXELS } from './constants';
import { cacheLocation, shareFileName, toPath, toUri } from './helpers';
import type { DocumentLookup, RepositorySource, ShareCopy } from './types';

export async function decryptDocumentFile(
  lookup: DocumentLookup,
  cacheUri: string,
  id: string,
): Promise<string | null> {
  const doc = await lookup.getDocument(id);
  if (!doc) return null;
  const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpg';
  const { uri, path } = cacheLocation(cacheUri, decryptedName(id, extension));
  await ExpoVaultModule.getFile(doc.fileKey, path);
  return uri;
}

export async function decryptThumbnail(
  lookup: DocumentLookup,
  cacheUri: string,
  id: string,
): Promise<string | null> {
  const doc = await lookup.getDocument(id);
  if (!doc) return null;
  const { uri, path } = cacheLocation(cacheUri, thumbnailName(id));
  try {
    await ExpoVaultModule.getFile(doc.thumbnailKey, path);
    return uri;
  } catch {
    return null;
  }
}

export async function decryptPages(
  lookup: DocumentLookup,
  cacheUri: string,
  repositorySource: RepositorySource,
  id: string,
): Promise<string[]> {
  const doc = await lookup.getDocument(id);
  if (!doc) return [];
  const main = await lookup.getDocumentFile(id);
  if (!main) return [];
  if (doc.fileType === 'pdf') {
    const { path } = cacheLocation(cacheUri, pdfPagesName(id));
    const pages = await ExpoVaultModule.renderPdfPages(toPath(main), PAGE_MAX_PIXELS, path);
    return pages.map((page) => toUri(page.uri));
  }
  const pageKeys = await (await repositorySource()).getPages(id);
  const uris = [main];
  for (const [index, key] of pageKeys.entries()) {
    const { uri, path } = cacheLocation(cacheUri, decryptedPageName(id, index + 1));
    await ExpoVaultModule.getFile(key, path);
    uris.push(uri);
  }
  return uris;
}

export async function prepareShareCopy(
  lookup: DocumentLookup,
  id: string,
): Promise<ShareCopy | null> {
  const doc = await lookup.getDocument(id);
  const source = await lookup.getDocumentFile(id);
  if (!doc || !source) return null;
  // Match declared UTI extension (jpeg/pdf) so iOS expo-sharing doesn't hard-link into an unmanaged staging dir.
  const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpeg';
  // Per-share UUID folder prevents reused Android content URI read grants from accessing future shares.
  const directory = new Directory(Paths.cache, SHARE_DIRECTORY, Crypto.randomUUID());
  directory.create({ intermediates: true, idempotent: true });
  const target = new File(directory, `${shareFileName(doc.title)}.${extension}`);
  const folder = toPath(directory.uri).replace(/\/+$/, '');
  // Use removeTreeNoFollow because expo-file-system delete on Android follows symlinks.
  const remove = () => {
    try {
      ExpoVaultModule.removeTreeNoFollow(folder);
    } catch {
      // Swept by clearCache.
    }
  };
  try {
    await new File(toUri(source)).copy(target);
  } catch (e) {
    remove();
    throw e;
  }
  return {
    uri: target.uri,
    expireAfter: (ms) => ExpoVaultModule.scheduleShareExpiry(folder, ms),
    discard: () => {
      try {
        ExpoVaultModule.cancelShareExpiry(folder);
      } catch {
        // Nothing was scheduled.
      }
      remove();
    },
  };
}
