import { Paths } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import type { Document, PickedFile } from '@/types';

import { UNDO_WINDOW_MS } from './constants';
import { copyForUndo, discardDeleted, removeDocument, removeVaultEntries } from './deletion';
import { DocumentIndex } from './DocumentIndex';
import { importDocument, previewForFile } from './importer';
import * as residue from './residue';
import { decryptDocumentFile, decryptPages, decryptThumbnail, prepareShareCopy } from './storage';
import type { DeletedDocument, ShareCopy } from './types';

class DocumentService extends DocumentIndex {
  private undoTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private cacheUri = Paths.cache.uri;

  async addDocument(
    input: PickedFile | PickedFile[],
    metadata: Partial<Document>,
  ): Promise<Document> {
    const document = await importDocument(this.cacheUri, () => this.repository(), input, metadata);
    this.notify();
    return document;
  }

  discardPickedCopy(uri: string): void {
    residue.discardPickedCopy(uri);
  }

  discardSystemImportCopy(name: string): void {
    residue.discardSystemImportCopy(name);
  }

  previewForFile(uri: string, mimeType: string): Promise<string | null> {
    return previewForFile(this.cacheUri, uri, mimeType);
  }

  discardPreview(uri: string): void {
    residue.discardPreview(this.cacheUri, uri);
  }

  getDocumentPages(id: string): Promise<string[]> {
    return decryptPages(this, this.cacheUri, () => this.repository(), id);
  }

  prepareShareFile(id: string): Promise<ShareCopy | null> {
    return prepareShareCopy(this, id);
  }

  async deleteDocumentWithUndo(id: string): Promise<DeletedDocument | null> {
    const deleted = await copyForUndo(this, this.cacheUri, () => this.repository(), id);
    if (!deleted) return null;
    try {
      await this.deleteDocument(id);
    } catch (error) {
      discardDeleted(this.cacheUri, deleted);
      throw error;
    }
    this.undoTimers.set(
      id,
      setTimeout(() => {
        this.undoTimers.delete(id);
        discardDeleted(this.cacheUri, deleted);
      }, UNDO_WINDOW_MS),
    );
    return deleted;
  }

  async restoreDocument(deleted: DeletedDocument): Promise<Document> {
    const { document, fields, files } = deleted;
    const timer = this.undoTimers.get(document.id);
    if (timer) clearTimeout(timer);
    this.undoTimers.delete(document.id);
    const restored = await this.addDocument(files, {
      id: document.id,
      title: document.title,
      category: document.category,
      tags: document.tags,
      ocrText: document.ocrText,
      createdAt: document.createdAt,
    });
    if (fields.length > 0) await this.setFields(document.id, fields);
    discardDeleted(this.cacheUri, deleted);
    return restored;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const removed = await removeDocument(await this.repository(), id);
    if (removed) this.notify();
    return removed;
  }

  getDocumentFile(id: string): Promise<string | null> {
    return decryptDocumentFile(this, this.cacheUri, id);
  }

  getDocumentThumbnail(id: string): Promise<string | null> {
    return decryptThumbnail(this, this.cacheUri, id);
  }

  async eraseEverything(): Promise<void> {
    for (const timer of this.undoTimers.values()) clearTimeout(timer);
    this.undoTimers.clear();
    try {
      await documentDatabase.erase(removeVaultEntries);
    } finally {
      await this.clearCache();
    }
    this.notify();
  }

  sweepLegacyScratch(): void {
    residue.sweepLegacyScratch(this.cacheUri);
  }

  clearCache(): Promise<void> {
    return residue.clearCache(this.cacheUri);
  }
}

export const documentService = new DocumentService();
