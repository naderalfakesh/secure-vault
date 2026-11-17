import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { t } from '@/i18n';
import { type Document, DocumentCategory, type PickedFile } from '@/types';

import ExpoVaultModule from '../../../modules/expo-vault';
import { removeNoFollow } from '../removeNoFollow';
import {
  FILE_PREFIX,
  IMPORT_COPY_PREFIX,
  IMPORT_COPY_TIMEOUT_MS,
  PAGE_MAX_PIXELS,
  PAGE_PREFIX,
  PREVIEW_PREFIX,
  THUMB_PREFIX,
  THUMBNAIL_MAX_PIXELS,
} from './constants';
import { cacheLocation, toPath, toUri } from './helpers';
import { discardImportCopy, discardPickedCopy } from './residue';
import type { RepositorySource } from './types';

/**
 * Stores one document from one or more source files. The first file is the
 * document's main file and thumbnail source; further files become pages.
 */
export async function importDocument(
  cacheUri: string,
  repositorySource: RepositorySource,
  input: PickedFile | PickedFile[],
  metadata: Partial<Document>,
): Promise<Document> {
  const files = Array.isArray(input) ? input : [input];
  const file = files[0];
  if (!file) throw new Error('A document needs at least one file.');
  const repository = await repositorySource();
  const id = metadata.id ?? Crypto.randomUUID();
  const fileKey = `${FILE_PREFIX}${id}`;
  const thumbnailKey = `${THUMB_PREFIX}${id}`;
  const now = new Date().toISOString();
  const fileType: Document['fileType'] = file.type?.includes('pdf') ? 'pdf' : 'image';

  // What the document takes, all pages counted. A scan or a photo often
  // comes without a size, so it is measured from the copy being encrypted.
  let fileSize = 0;
  const sourcePath = await getLocalFilePath(cacheUri, file.uri);
  try {
    fileSize += file.size || measure(sourcePath);
    await ExpoVaultModule.putFile(fileKey, sourcePath);
    try {
      const thumbnailSource =
        fileType === 'pdf' ? await renderPdfCover(cacheUri, sourcePath, id) : sourcePath;
      if (thumbnailSource) {
        await ExpoVaultModule.putThumbnail(thumbnailKey, thumbnailSource, THUMBNAIL_MAX_PIXELS);
      }
    } catch {
      // A missing thumbnail only costs a placeholder in the list.
    }
  } finally {
    // A retry copies the content:// file again, so its copy never outlives this call.
    discardImportCopy(cacheUri, sourcePath);
  }

  // A save that fails part way leaves nothing behind, so a retry from the
  // same pick makes one document, never a second.
  const pageKeys: string[] = [];
  let inserted = false;
  let document: Document;
  try {
    for (const [index, page] of files.slice(1).entries()) {
      const pageKey = `${PAGE_PREFIX}${id}_${index + 1}`;
      const pagePath = await getLocalFilePath(cacheUri, page.uri);
      try {
        pageKeys.push(pageKey);
        fileSize += page.size || measure(pagePath);
        await ExpoVaultModule.putFile(pageKey, pagePath);
      } finally {
        discardImportCopy(cacheUri, pagePath);
      }
    }

    document = await repository.insert({
      id,
      title: metadata.title || file.name || t('scan.untitled'),
      category: metadata.category || DocumentCategory.OTHER,
      tags: metadata.tags || [],
      ocrText: metadata.ocrText,
      thumbnailKey,
      fileKey,
      fileType,
      fileSize,
      createdAt: metadata.createdAt ?? now,
    });
    inserted = true;
    if (pageKeys.length > 0) await repository.setPages(id, pageKeys);
  } catch (e) {
    if (inserted) await repository.remove(id).catch(() => false);
    for (const key of [fileKey, thumbnailKey, ...pageKeys]) {
      await ExpoVaultModule.deleteFile(key).catch(() => {});
    }
    throw e;
  }
  // Kept until now so a failed save can be retried from the same pick.
  for (const source of files) discardPickedCopy(source.uri);
  return document;
}

/** First page of a PDF as a JPEG in the cache, or null when it cannot be rendered. */
async function renderPdfCover(
  cacheUri: string,
  pdfPath: string,
  id: string,
): Promise<string | null> {
  const { path } = cacheLocation(cacheUri, `pages_${id}_cover`);
  const [cover] = await ExpoVaultModule.renderPdfPages(pdfPath, THUMBNAIL_MAX_PIXELS, path);
  return cover ? toPath(cover.uri) : null;
}

/**
 * An image to show and read before a picked file is saved: the file itself
 * for photos, the rendered first page for PDFs, null when neither works.
 */
export async function previewForFile(
  cacheUri: string,
  uri: string,
  mimeType: string,
): Promise<string | null> {
  if (!mimeType.includes('pdf')) return uri;
  let path: string | null = null;
  const folderName = `${PREVIEW_PREFIX}${Date.now()}`;
  // A render that fails or yields no page leaves no empty preview folder behind.
  const removeFolder = () => {
    try {
      removeNoFollow(new Directory(cacheUri, folderName));
    } catch {
      // Swept by clearCache.
    }
  };
  try {
    path = await getLocalFilePath(cacheUri, uri);
    const { path: directory } = cacheLocation(cacheUri, folderName);
    const [page] = await ExpoVaultModule.renderPdfPages(path, PAGE_MAX_PIXELS, directory);
    if (!page) removeFolder();
    return page ? toUri(page.uri) : null;
  } catch {
    removeFolder();
    return null;
  } finally {
    // The save copies a content:// file again; the preview is the rendered page.
    if (path) discardImportCopy(cacheUri, path);
  }
}

/** The size of a local file in bytes, or 0 when it cannot be read. */
function measure(path: string): number {
  try {
    return new File(toUri(path)).size || 0;
  } catch {
    return 0;
  }
}

/**
 * Copies a `content://` source into the cache so the native module can read a
 * path. No picker hands one over today (each copies into its own cache folder
 * first), but the scanner's page URIs come from Google Play services, whose
 * scheme the app does not control. The copy goes through expo-file-system,
 * which reads the provider with the content resolver: SDK 58's global fetch
 * refuses the scheme.
 */
async function getLocalFilePath(cacheUri: string, uri: string): Promise<string> {
  if (uri.startsWith('/') || uri.startsWith('file://')) {
    return toPath(uri);
  }
  const tempFile = new File(Paths.cache, `${IMPORT_COPY_PREFIX}${Date.now()}`);
  const copying = new File(uri).copy(tempFile);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('The file took too long to read.'), {
            code: 'IMPORT_COPY_TIMEOUT',
          }),
        ),
      IMPORT_COPY_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([copying, stalled]);
    return toPath(tempFile.uri);
  } catch (e) {
    // A copy cut short by a read or write error is plaintext too. The copy
    // cannot be cancelled, so a stalled one is removed again once it settles.
    discardImportCopy(cacheUri, tempFile.uri);
    copying.then(
      () => discardImportCopy(cacheUri, tempFile.uri),
      () => discardImportCopy(cacheUri, tempFile.uri),
    );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
