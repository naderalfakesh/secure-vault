import * as Crypto from 'expo-crypto';
import { Directory } from 'expo-file-system';

import { t } from '@/i18n';
import { type Document, DocumentCategory, type PickedFile } from '@/types';
import ExpoVaultModule from '@modules/expo-vault';

import { removeNoFollow } from '../removeNoFollow';
import {
  FILE_PREFIX,
  PAGE_MAX_PIXELS,
  PAGE_PREFIX,
  PREVIEW_PREFIX,
  THUMB_PREFIX,
  THUMBNAIL_MAX_PIXELS,
} from './constants';
import { cacheLocation, toUri } from './helpers';
import { getLocalFilePath, measureFileSize, renderPdfCover } from './localCopy';
import { discardImportCopy, discardPickedCopy } from './residue';
import type { RepositorySource } from './types';

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

  let fileSize = 0;
  const sourcePath = await getLocalFilePath(cacheUri, file.uri);
  try {
    fileSize += file.size || measureFileSize(sourcePath);
    await ExpoVaultModule.putFile(fileKey, sourcePath);
    try {
      const thumbnailSource =
        fileType === 'pdf' ? await renderPdfCover(cacheUri, sourcePath, id) : sourcePath;
      if (thumbnailSource) {
        await ExpoVaultModule.putThumbnail(thumbnailKey, thumbnailSource, THUMBNAIL_MAX_PIXELS);
      }
    } catch {
      // Non-fatal; list falls back to placeholder.
    }
  } finally {
    discardImportCopy(cacheUri, sourcePath);
  }

  const pageKeys: string[] = [];
  let inserted = false;
  let document: Document;
  try {
    for (const [index, page] of files.slice(1).entries()) {
      const pageKey = `${PAGE_PREFIX}${id}_${index + 1}`;
      const pagePath = await getLocalFilePath(cacheUri, page.uri);
      try {
        pageKeys.push(pageKey);
        fileSize += page.size || measureFileSize(pagePath);
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
  // Keep picked copies until commit so a failed save can be retried from the same pick.
  for (const source of files) discardPickedCopy(source.uri);
  return document;
}

export async function previewForFile(
  cacheUri: string,
  uri: string,
  mimeType: string,
): Promise<string | null> {
  if (!mimeType.includes('pdf')) return uri;
  let path: string | null = null;
  const folderName = `${PREVIEW_PREFIX}${Date.now()}`;
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
    if (path) discardImportCopy(cacheUri, path);
  }
}
