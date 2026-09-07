import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { closeDocumentStore, openDocumentStore } from '@/data/database';
import type { DocumentRepository, ExtractedField } from '@/data/DocumentRepository';
import { type Document, DocumentCategory, type PickedFile } from '@/types';

import ExpoVaultModule from '../../modules/expo-vault';

const FILE_PREFIX = 'file_';
const THUMB_PREFIX = 'thumb_';
const PAGE_PREFIX = 'page_';
// Two-column grid cells are about 180 pt wide, so 512 px covers 3x screens.
const THUMBNAIL_MAX_PIXELS = 512;

type ChangeListener = () => void;

/**
 * Coordinates the two stores a document lives in: encrypted bytes in the vault
 * module (files and thumbnails) and the encrypted SQLite index (everything
 * searchable). Screens talk to this service through hooks, never to either
 * store directly.
 */
class DocumentService {
  private listeners = new Set<ChangeListener>();
  private cacheUri = Paths.cache.uri;

  private toPath(uriOrPath: string): string {
    return uriOrPath.startsWith('file://') ? uriOrPath.replace('file://', '') : uriOrPath;
  }

  private toUri(pathOrUri: string): string {
    return pathOrUri.startsWith('file://') ? pathOrUri : `file://${pathOrUri}`;
  }

  private getCacheLocation(filename: string) {
    const uri = `${this.cacheUri}${filename}`;
    return { uri, path: this.toPath(uri) };
  }

  private isCachePath(path: string) {
    return path.startsWith(this.toPath(this.cacheUri));
  }

  private async repository(): Promise<DocumentRepository> {
    return (await openDocumentStore()).repository;
  }

  /** Opens the index; safe to call repeatedly. */
  async initialize(): Promise<void> {
    await openDocumentStore();
  }

  /**
   * Subscribe to index changes so every mounted list refreshes after an add,
   * update, delete, or restore without polling. Returns the unsubscribe.
   */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Reopen the index, e.g. after a backup restore replaced the vault. */
  async reload(): Promise<void> {
    await closeDocumentStore();
    await openDocumentStore();
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  /**
   * Stores one document from one or more source files. The first file is the
   * document's main file and thumbnail source; further files become pages.
   */
  async addDocument(
    input: PickedFile | PickedFile[],
    metadata: Partial<Document>,
  ): Promise<Document> {
    const files = Array.isArray(input) ? input : [input];
    const file = files[0];
    if (!file) throw new Error('A document needs at least one file.');
    const repository = await this.repository();
    const id = Crypto.randomUUID();
    const fileKey = `${FILE_PREFIX}${id}`;
    const thumbnailKey = `${THUMB_PREFIX}${id}`;
    const now = new Date().toISOString();
    const fileType: Document['fileType'] = file.type?.includes('pdf') ? 'pdf' : 'image';

    const sourcePath = await this.getLocalFilePath(file.uri);
    await ExpoVaultModule.putFile(fileKey, sourcePath);
    if (fileType === 'image') {
      try {
        await ExpoVaultModule.putThumbnail(thumbnailKey, sourcePath, THUMBNAIL_MAX_PIXELS);
      } catch {
        // A missing thumbnail only costs a placeholder in the list.
      }
    }

    this.discardTemp(sourcePath, file.uri);

    const pageKeys: string[] = [];
    for (const [index, page] of files.slice(1).entries()) {
      const pageKey = `${PAGE_PREFIX}${id}_${index + 1}`;
      const pagePath = await this.getLocalFilePath(page.uri);
      await ExpoVaultModule.putFile(pageKey, pagePath);
      this.discardTemp(pagePath, page.uri);
      pageKeys.push(pageKey);
    }

    const document = await repository.insert({
      id,
      title: metadata.title || file.name || 'Untitled document',
      category: metadata.category || DocumentCategory.OTHER,
      tags: metadata.tags || [],
      ocrText: metadata.ocrText,
      thumbnailKey,
      fileKey,
      fileType,
      fileSize: file.size || 0,
      createdAt: now,
    });
    if (pageKeys.length > 0) await repository.setPages(id, pageKeys);
    this.notify();
    return document;
  }

  private discardTemp(sourcePath: string, originalUri: string) {
    if (sourcePath === this.toPath(originalUri) || !this.isCachePath(sourcePath)) return;
    try {
      const tempFile = new File(this.toUri(sourcePath));
      if (tempFile.exists) tempFile.delete();
    } catch {
      // Cache files are also swept by clearCache.
    }
  }

  /** Decrypts every page (main file first) into the cache and returns their URIs. */
  async getDocumentPages(id: string): Promise<string[]> {
    const doc = await this.getDocument(id);
    if (!doc) return [];
    const main = await this.getDocumentFile(id);
    const pageKeys = await (await this.repository()).getPages(id);
    const uris = main ? [main] : [];
    for (const [index, key] of pageKeys.entries()) {
      const { uri, path } = this.getCacheLocation(`decrypted_${id}_p${index + 1}.jpg`);
      await ExpoVaultModule.getFile(key, path);
      uris.push(uri);
    }
    return uris;
  }

  async getDocument(id: string): Promise<Document | null> {
    return (await this.repository()).get(id);
  }

  async getAllDocuments(): Promise<Document[]> {
    return (await this.repository()).list();
  }

  async getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
    return (await this.repository()).list(category);
  }

  async getRecentDocuments(limit: number): Promise<Document[]> {
    return (await this.repository()).recent(limit);
  }

  async countByCategory(): Promise<Partial<Record<DocumentCategory, number>>> {
    return (await this.repository()).countByCategory();
  }

  async searchDocuments(query: string): Promise<Document[]> {
    return (await this.repository()).search(query);
  }

  async updateDocument(
    id: string,
    updates: Partial<Pick<Document, 'title' | 'category' | 'tags' | 'ocrText'>>,
  ): Promise<Document | null> {
    const document = await (await this.repository()).update(id, updates);
    if (document) this.notify();
    return document;
  }

  async setFields(id: string, fields: ExtractedField[]): Promise<void> {
    await (await this.repository()).setFields(id, fields);
    this.notify();
  }

  async getFields(id: string): Promise<ExtractedField[]> {
    return (await this.repository()).getFields(id);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const repository = await this.repository();
    const doc = await repository.get(id);
    if (!doc) return false;

    await ExpoVaultModule.deleteFile(doc.fileKey).catch(() => {});
    await ExpoVaultModule.deleteFile(doc.thumbnailKey).catch(() => {});
    for (const key of await repository.getPages(id)) {
      await ExpoVaultModule.deleteFile(key).catch(() => {});
    }
    const removed = await repository.remove(id);
    if (removed) this.notify();
    return removed;
  }

  /** Decrypts the document into the cache and returns its file URI. */
  async getDocumentFile(id: string): Promise<string | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;
    const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpg';
    const { uri, path } = this.getCacheLocation(`decrypted_${id}.${extension}`);
    await ExpoVaultModule.getFile(doc.fileKey, path);
    return uri;
  }

  async getDocumentThumbnail(id: string): Promise<string | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;
    const { uri, path } = this.getCacheLocation(`thumb_${id}.jpg`);
    try {
      await ExpoVaultModule.getFile(doc.thumbnailKey, path);
      return uri;
    } catch {
      return null;
    }
  }

  /** Remove every decrypted file from the cache directory. */
  async clearCache(): Promise<void> {
    try {
      for (const entry of new Directory(this.cacheUri).list()) {
        const { name } = entry;
        if (
          name.startsWith('decrypted_') ||
          name.startsWith('thumb_') ||
          name.startsWith('temp_')
        ) {
          try {
            entry.delete();
          } catch {
            // Best effort; the OS also purges the cache directory.
          }
        }
      }
    } catch {
      // The cache directory may not exist yet.
    }
  }

  /** Copies content:// sources (Android pickers) into the cache so the native module can read a path. */
  private async getLocalFilePath(uri: string): Promise<string> {
    if (uri.startsWith('/') || uri.startsWith('file://')) {
      return this.toPath(uri);
    }
    const tempFile = new File(Paths.cache, `temp_import_${Date.now()}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(uri, { signal: controller.signal });
      const bytes = await response.arrayBuffer();
      tempFile.write(new Uint8Array(bytes));
      return this.toPath(tempFile.uri);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const documentService = new DocumentService();
export default documentService;
