import type { DocumentRepository } from '@/data/DocumentRepository';
import type { PickedFile } from '@/types';
import { AppError } from '@/utils/AppError';
import ExpoVaultModule from '@modules/expo-vault';

import { undoName, undoPageName } from './cacheNames';
import { cacheLocation, toPath } from './helpers';
import { discardTemp } from './residue';
import type { DeletedDocument, DocumentLookup, RepositorySource } from './types';

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
  const main = cacheLocation(cacheUri, undoName(id, extension));
  await ExpoVaultModule.getFile(document.fileKey, main.path);
  files.push({
    uri: main.uri,
    name: `${document.title}.${extension}`,
    type: document.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
    size: document.fileSize,
  });
  const pageKeys = await (await repositorySource()).getPages(id);
  for (const [index, key] of pageKeys.entries()) {
    const page = cacheLocation(cacheUri, undoPageName(id, index + 1));
    await ExpoVaultModule.getFile(key, page.path);
    files.push({ uri: page.uri, name: `page-${index + 1}.jpg`, type: 'image/jpeg' });
  }
  return { document, fields, files };
}

export function discardDeleted(cacheUri: string, deleted: DeletedDocument): void {
  for (const file of deleted.files) discardTemp(cacheUri, toPath(file.uri), '');
}

export async function removeDocument(repository: DocumentRepository, id: string): Promise<boolean> {
  const doc = await repository.get(id);
  if (!doc) return false;

  // Delete main file last and keep DB row on partial failure so a retry can finish cleanly.
  const keys = [...(await repository.getPages(id)), doc.thumbnailKey, doc.fileKey];
  const failures: unknown[] = [];
  for (const key of keys) {
    try {
      await ExpoVaultModule.deleteFile(key);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AppError(
      'DELETE_INCOMPLETE',
      `${failures.length} of ${keys.length} encrypted files of document ${id} could not be removed`,
      { cause: failures[0] },
    );
  }
  return repository.remove(id);
}

// Native delete rejects for missing keys; ignore per-key errors during full wipe.
export async function removeVaultEntries(): Promise<void> {
  for (const key of await ExpoVaultModule.getAllKeys()) {
    await ExpoVaultModule.delete(key).catch(() => {});
    await ExpoVaultModule.deleteFile(key).catch(() => {});
  }
}
