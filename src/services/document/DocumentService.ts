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

/**
 * Coordinates the two stores a document lives in: encrypted bytes in the vault
 * module (files and thumbnails) and the encrypted SQLite index (everything
 * searchable). Screens talk to this service through hooks, never to either
 * store directly.
 *
 * The index side (reads, metadata writes, change events) is `DocumentIndex`;
 * the file work lives in `importer`, `storage`, `deletion` and `residue`.
 * Those call back into this object for lookups, so a spy on the singleton
 * still reaches every caller.
 */
class DocumentService extends DocumentIndex {
  private undoTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private cacheUri = Paths.cache.uri;

  /**
   * Stores one document from one or more source files. The first file is the
   * document's main file and thumbnail source; further files become pages.
   */
  async addDocument(
    input: PickedFile | PickedFile[],
    metadata: Partial<Document>,
  ): Promise<Document> {
    const document = await importDocument(this.cacheUri, () => this.repository(), input, metadata);
    this.notify();
    return document;
  }

  /**
   * Removes a picker's or the scanner's plaintext copy of a picked file. Only
   * a file directly inside one of their cache folders, or an iOS scanner page
   * directly in tmp, qualifies; anything else is the user's own file.
   */
  discardPickedCopy(uri: string): void {
    residue.discardPickedCopy(uri);
  }

  /** Removes iOS's Inbox copy of a file just picked from Files (see `residue`). */
  discardSystemImportCopy(name: string): void {
    residue.discardSystemImportCopy(name);
  }

  /**
   * An image to show and read before a picked file is saved: the file itself
   * for photos, the rendered first page for PDFs, null when neither works.
   */
  previewForFile(uri: string, mimeType: string): Promise<string | null> {
    return previewForFile(this.cacheUri, uri, mimeType);
  }

  /** Removes the folder `previewForFile` rendered a PDF preview into. */
  discardPreview(uri: string): void {
    residue.discardPreview(this.cacheUri, uri);
  }

  /**
   * Every page of a document as image URIs in the cache, main file first.
   * PDFs are rasterised natively so the viewer never needs a PDF renderer.
   */
  getDocumentPages(id: string): Promise<string[]> {
    return decryptPages(this, this.cacheUri, () => this.repository(), id);
  }

  /**
   * A decrypted copy named after the document, ready for the share sheet.
   * Call `discard` once the sheet closes; `clearCache` sweeps it too.
   */
  prepareShareFile(id: string): Promise<ShareCopy | null> {
    return prepareShareCopy(this, id);
  }

  /**
   * Removes the document but keeps decrypted copies in the cache so
   * `restoreDocument` can put it back during the undo window.
   */
  async deleteDocumentWithUndo(id: string): Promise<DeletedDocument | null> {
    const deleted = await copyForUndo(this, this.cacheUri, () => this.repository(), id);
    if (!deleted) return null;
    await this.deleteDocument(id);
    // The decrypted copies outlive the row only for the undo window.
    this.undoTimers.set(
      id,
      setTimeout(() => {
        this.undoTimers.delete(id);
        discardDeleted(this.cacheUri, deleted);
      }, UNDO_WINDOW_MS),
    );
    return deleted;
  }

  /** Puts a deleted document back under its original id and dates. */
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

  /** Decrypts the document into the cache and returns its file URI. */
  getDocumentFile(id: string): Promise<string | null> {
    return decryptDocumentFile(this, this.cacheUri, id);
  }

  getDocumentThumbnail(id: string): Promise<string | null> {
    return decryptThumbnail(this, this.cacheUri, id);
  }

  /**
   * Wipes every document, the index, and the vault's entries. The device key
   * itself stays so the next setup can reuse it.
   */
  async eraseEverything(): Promise<void> {
    for (const timer of this.undoTimers.values()) clearTimeout(timer);
    this.undoTimers.clear();
    try {
      await documentDatabase.erase(removeVaultEntries);
    } finally {
      // Only caches: decrypted copies go also when the erase did not finish.
      await this.clearCache();
    }
    this.notify();
  }

  /**
   * Launch-only sweep of scratch files older builds left: iOS `tmp/backup-<UUID>`
   * and `tmp/<UUID>`, Android `cacheDir/backup*.tmp` and `filesDir/vault*.tmp`.
   */
  sweepLegacyScratch(): void {
    residue.sweepLegacyScratch(this.cacheUri);
  }

  /** Remove every decrypted file from the cache directory, and every image the image library cached. */
  clearCache(): Promise<void> {
    return residue.clearCache(this.cacheUri);
  }
}

export const documentService = new DocumentService();
