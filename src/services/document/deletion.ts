import type { DocumentRepository } from '@/data/DocumentRepository';
import type { PickedFile } from '@/types';

import ExpoVaultModule from '../../../modules/expo-vault';
import { cacheLocation, toPath } from './helpers';
import { discardTemp } from './residue';
import type { DeletedDocument, DocumentLookup, RepositorySource } from './types';

/**
 * Decrypts a document and its pages into the cache, so it can be put back
 * after it is deleted; null when there is no such document.
 */
export async function copyForUndo(
  lookup: DocumentLookup,
  cacheUri: string,
  repositorySource: RepositorySource,
  id: string,
): Promise<DeletedDocument | null> {
  const document = await lookup.getDocument(id);
  if (!document) return null;
  const fields = await lookup.getFields(id);
  const extension = document.fileType === 'pdf' ? 'pdf' : 'jpg';
  const files: PickedFile[] = [];
  const main = cacheLocation(cacheUri, `undo_${id}.${extension}`);
  await ExpoVaultModule.getFile(document.fileKey, main.path);
  files.push({
    uri: main.uri,
    name: `${document.title}.${extension}`,
    type: document.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
    size: document.fileSize,
  });
  const pageKeys = await (await repositorySource()).getPages(id);
  for (const [index, key] of pageKeys.entries()) {
    const page = cacheLocation(cacheUri, `undo_${id}_p${index + 1}.jpg`);
    await ExpoVaultModule.getFile(key, page.path);
    files.push({ uri: page.uri, name: `page-${index + 1}.jpg`, type: 'image/jpeg' });
  }
  return { document, fields, files };
}

/** Drops the decrypted copies once undo is no longer possible. */
export function discardDeleted(cacheUri: string, deleted: DeletedDocument): void {
  for (const file of deleted.files) discardTemp(cacheUri, toPath(file.uri), '');
}

/** Removes a document's encrypted files and pages from the vault, then its row. */
export async function removeDocument(repository: DocumentRepository, id: string): Promise<boolean> {
  const doc = await repository.get(id);
  if (!doc) return false;

  await ExpoVaultModule.deleteFile(doc.fileKey).catch(() => {});
  await ExpoVaultModule.deleteFile(doc.thumbnailKey).catch(() => {});
  for (const key of await repository.getPages(id)) {
    await ExpoVaultModule.deleteFile(key).catch(() => {});
  }
  return repository.remove(id);
}

/** Every vault entry and encrypted file, for "Delete everything". */
export async function removeVaultEntries(): Promise<void> {
  for (const key of await ExpoVaultModule.getAllKeys()) {
    await ExpoVaultModule.delete(key).catch(() => {});
    await ExpoVaultModule.deleteFile(key).catch(() => {});
  }
}
