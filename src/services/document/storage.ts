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

/** Decrypts the document into the cache and returns its file URI. */
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

/**
 * Every page of a document as image URIs in the cache, main file first.
 * PDFs are rasterised natively so the viewer never needs a PDF renderer.
 */
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

/**
 * A decrypted copy named after the document, ready for the share sheet.
 * Call `discard` once the sheet closes; `clearCache` sweeps it too.
 */
export async function prepareShareCopy(
  lookup: DocumentLookup,
  id: string,
): Promise<ShareCopy | null> {
  const doc = await lookup.getDocument(id);
  const source = await lookup.getDocumentFile(id);
  if (!doc || !source) return null;
  // The extension matches the declared type's (public.jpeg, com.adobe.pdf),
  // so expo-sharing on iOS shares this file as is instead of hard-linking it
  // into a staging folder of its own that our discard would not reach.
  const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpeg';
  // A folder per share: Android grants every share target read access to the
  // copy's content URI, and those grants outlive the file. A fresh path means
  // a later copy never answers to an earlier share's grants.
  const directory = new Directory(Paths.cache, SHARE_DIRECTORY, Crypto.randomUUID());
  directory.create({ intermediates: true, idempotent: true });
  const target = new File(directory, `${shareFileName(doc.title)}.${extension}`);
  const folder = toPath(directory.uri).replace(/\/+$/, '');
  // Never followed through a link: expo-file-system's delete on Android
  // empties a link's target before removing the link.
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
    // A copy cut short is plaintext too.
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
