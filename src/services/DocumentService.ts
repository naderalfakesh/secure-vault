import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

import { deleteDocumentStore, openDocumentStore } from '@/data/database';
import type { DocumentRepository, ExtractedField } from '@/data/DocumentRepository';
import { type Document, DocumentCategory, type PickedFile } from '@/types';

import ExpoVaultModule from '../../modules/expo-vault';

const FILE_PREFIX = 'file_';
const THUMB_PREFIX = 'thumb_';
const PAGE_PREFIX = 'page_';
// Two-column grid cells are about 180 pt wide, so 512 px covers 3x screens.
const THUMBNAIL_MAX_PIXELS = 512;
// Full-screen pages on a 3x phone; larger only costs memory in the viewer.
const PAGE_MAX_PIXELS = 2048;
// How long the undo toast stays up, and how much longer the decrypted copies
// survive so a tap on a visible Undo always finds them.
export const UNDO_TOAST_MS = 5000;
export const UNDO_WINDOW_MS = 8000;
/**
 * Where the document picker copies a picked file when asked to: a UUID-named
 * file in `Caches/DocumentPicker` on iOS and `cacheDir/DocumentPicker` on
 * Android. An imported document's copy there is plaintext.
 */
export const PICKER_DIRECTORY = 'DocumentPicker';
/** expo-image-picker's copies of chosen and taken photos: `Caches/ImagePicker`, `cacheDir/ImagePicker`. */
export const IMAGE_PICKER_DIRECTORY = 'ImagePicker';
/** Where the ML Kit scanner client copies each page on Android: `cacheDir/mlkit_docscan_ui_client`. */
export const SCANNER_DIRECTORY = 'mlkit_docscan_ui_client';
const IMPORT_DIRECTORIES = [PICKER_DIRECTORY, IMAGE_PICKER_DIRECTORY, SCANNER_DIRECTORY];
const UUID_PATTERN = '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}';
/** The iOS scanner module's pages in tmp: `scan_<batch UUID>_<index>.jpg`. */
const SCAN_PAGE = new RegExp(`^scan_${UUID_PATTERN}_\\d+\\.jpg$`);

/** iOS reports tmp under /private/var and the other folders under /var, the same place. */
function canonicalPath(path: string): string {
  return path.replace(/^\/private\/var\//, '/var/');
}

/** The name of the entry at `path` when it sits directly inside `folder`, otherwise null. */
function childName(path: string, folder: string): string | null {
  const prefix = folder.replace(/\/?$/, '/');
  if (!path.startsWith(prefix)) return null;
  const name = path.slice(prefix.length);
  if (!name || name.includes('/') || name === '.' || name === '..') return null;
  return name;
}

type ChangeListener = () => void;

/** Everything needed to put a deleted document back, kept until the undo window closes. */
export interface DeletedDocument {
  document: Document;
  fields: ExtractedField[];
  /** Decrypted copies in the cache: main file first, then extra pages. */
  files: PickedFile[];
}

/**
 * Coordinates the two stores a document lives in: encrypted bytes in the vault
 * module (files and thumbnails) and the encrypted SQLite index (everything
 * searchable). Screens talk to this service through hooks, never to either
 * store directly.
 */
class DocumentService {
  private listeners = new Set<ChangeListener>();
  private undoTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

  /**
   * Open the current index and refresh every list, e.g. after a backup
   * restore replaced it. Nothing is closed here: a screen may still be
   * running a statement on the connection it already holds.
   */
  async reload(): Promise<void> {
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
    const id = metadata.id ?? Crypto.randomUUID();
    const fileKey = `${FILE_PREFIX}${id}`;
    const thumbnailKey = `${THUMB_PREFIX}${id}`;
    const now = new Date().toISOString();
    const fileType: Document['fileType'] = file.type?.includes('pdf') ? 'pdf' : 'image';

    const sourcePath = await this.getLocalFilePath(file.uri);
    await ExpoVaultModule.putFile(fileKey, sourcePath);
    try {
      const thumbnailSource =
        fileType === 'pdf' ? await this.renderPdfCover(sourcePath, id) : sourcePath;
      if (thumbnailSource) {
        await ExpoVaultModule.putThumbnail(thumbnailKey, thumbnailSource, THUMBNAIL_MAX_PIXELS);
      }
    } catch {
      // A missing thumbnail only costs a placeholder in the list.
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
      createdAt: metadata.createdAt ?? now,
    });
    if (pageKeys.length > 0) await repository.setPages(id, pageKeys);
    // Kept until now so a failed save can be retried from the same pick.
    for (const source of files) this.discardPickedCopy(source.uri);
    this.notify();
    return document;
  }

  /** Decoded, alias-free form of a file URI or path, for comparisons only. */
  private comparablePath(uriOrPath: string): string {
    return canonicalPath(decodeURIComponent(this.toPath(uriOrPath)));
  }

  /**
   * The app container's tmp folder on iOS, the sibling of Documents; null on
   * Android or when the container does not have the expected layout.
   */
  private appleTemporary(): { uri: string; path: string } | null {
    if (Platform.OS !== 'ios') return null;
    try {
      const documentsUri = Paths.document.uri.replace(/\/?$/, '/');
      if (!documentsUri.endsWith('/Documents/')) return null;
      const uri = `${documentsUri.slice(0, -'Documents/'.length)}tmp/`;
      const path = this.comparablePath(uri);
      const container = path.slice(0, -'tmp/'.length);
      if (!this.comparablePath(Paths.cache.uri).startsWith(container)) return null;
      return { uri, path };
    } catch {
      return null;
    }
  }

  /**
   * Removes a picker's or the scanner's plaintext copy of a picked file. Only
   * a file directly inside one of their cache folders, or an iOS scanner page
   * directly in tmp, qualifies; anything else, `..` paths included, is the
   * user's own file and is left alone.
   */
  discardPickedCopy(uri: string): void {
    let path: string;
    let cache: string;
    try {
      path = this.comparablePath(uri);
      cache = this.comparablePath(Paths.cache.uri).replace(/\/?$/, '/');
    } catch {
      return;
    }
    const tmp = this.appleTemporary();
    const inImportFolder = IMPORT_DIRECTORIES.some(
      (directory) => childName(path, `${cache}${directory}`) !== null,
    );
    const scanPage = tmp !== null && SCAN_PAGE.test(childName(path, tmp.path) ?? '');
    if (!inImportFolder && !scanPage) return;
    try {
      const copy = new File(this.toUri(uri));
      if (copy.exists) copy.delete();
    } catch {
      // The lock and launch sweep removes these folders and pages.
    }
  }

  /** The iOS scanner's pages left in tmp by a kill or a crash. */
  private sweepScanPages(): void {
    const tmp = this.appleTemporary();
    if (!tmp) return;
    try {
      for (const entry of new Directory(tmp.uri).list()) {
        if (entry instanceof File && SCAN_PAGE.test(entry.name)) entry.delete();
      }
    } catch {
      // Best effort; tmp may not exist yet.
    }
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

  /** First page of a PDF as a JPEG in the cache, or null when it cannot be rendered. */
  private async renderPdfCover(pdfPath: string, id: string): Promise<string | null> {
    const { path } = this.getCacheLocation(`pages_${id}_cover`);
    const [cover] = await ExpoVaultModule.renderPdfPages(pdfPath, THUMBNAIL_MAX_PIXELS, path);
    return cover ? this.toPath(cover.uri) : null;
  }

  /**
   * An image to show and read before a picked file is saved: the file itself
   * for photos, the rendered first page for PDFs, null when neither works.
   */
  async previewForFile(uri: string, mimeType: string): Promise<string | null> {
    if (!mimeType.includes('pdf')) return uri;
    try {
      const path = await this.getLocalFilePath(uri);
      const { path: directory } = this.getCacheLocation(`pages_preview_${Date.now()}`);
      const [page] = await ExpoVaultModule.renderPdfPages(path, PAGE_MAX_PIXELS, directory);
      return page ? this.toUri(page.uri) : null;
    } catch {
      return null;
    }
  }

  /**
   * Every page of a document as image URIs in the cache, main file first.
   * PDFs are rasterised natively so the viewer never needs a PDF renderer.
   */
  async getDocumentPages(id: string): Promise<string[]> {
    const doc = await this.getDocument(id);
    if (!doc) return [];
    const main = await this.getDocumentFile(id);
    if (!main) return [];
    if (doc.fileType === 'pdf') {
      const { path } = this.getCacheLocation(`pages_${id}`);
      const pages = await ExpoVaultModule.renderPdfPages(this.toPath(main), PAGE_MAX_PIXELS, path);
      return pages.map((page) => this.toUri(page.uri));
    }
    const pageKeys = await (await this.repository()).getPages(id);
    const uris = [main];
    for (const [index, key] of pageKeys.entries()) {
      const { uri, path } = this.getCacheLocation(`decrypted_${id}_p${index + 1}.jpg`);
      await ExpoVaultModule.getFile(key, path);
      uris.push(uri);
    }
    return uris;
  }

  /**
   * A decrypted copy named after the document, ready for the share sheet.
   * Call `discard` once the sheet closes; `clearCache` sweeps it too.
   */
  async prepareShareFile(id: string): Promise<{ uri: string; discard: () => void } | null> {
    const doc = await this.getDocument(id);
    const source = await this.getDocumentFile(id);
    if (!doc || !source) return null;
    const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpg';
    const directory = new Directory(Paths.cache, 'share');
    if (!directory.exists) directory.create();
    const target = new File(directory, `${shareFileName(doc.title)}.${extension}`);
    if (target.exists) target.delete();
    await new File(this.toUri(source)).copy(target);
    return {
      uri: target.uri,
      discard: () => {
        try {
          if (target.exists) target.delete();
        } catch {
          // Swept by clearCache.
        }
      },
    };
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

  /** Documents whose extracted expiry date falls within `days` from today, soonest first. */
  async getExpiring(days: number): Promise<{ document: Document; date: string }[]> {
    const before = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    return (await this.repository()).expiring('expires', before);
  }

  async getFields(id: string): Promise<ExtractedField[]> {
    return (await this.repository()).getFields(id);
  }

  /**
   * Removes the document but keeps decrypted copies in the cache so
   * `restoreDocument` can put it back during the undo window.
   */
  async deleteDocumentWithUndo(id: string): Promise<DeletedDocument | null> {
    const document = await this.getDocument(id);
    if (!document) return null;
    const fields = await this.getFields(id);
    const extension = document.fileType === 'pdf' ? 'pdf' : 'jpg';
    const files: PickedFile[] = [];
    const main = this.getCacheLocation(`undo_${id}.${extension}`);
    await ExpoVaultModule.getFile(document.fileKey, main.path);
    files.push({
      uri: main.uri,
      name: `${document.title}.${extension}`,
      type: document.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
      size: document.fileSize,
    });
    const pageKeys = await (await this.repository()).getPages(id);
    for (const [index, key] of pageKeys.entries()) {
      const page = this.getCacheLocation(`undo_${id}_p${index + 1}.jpg`);
      await ExpoVaultModule.getFile(key, page.path);
      files.push({ uri: page.uri, name: `page-${index + 1}.jpg`, type: 'image/jpeg' });
    }
    await this.deleteDocument(id);
    const deleted = { document, fields, files };
    // The decrypted copies outlive the row only for the undo window.
    this.undoTimers.set(
      id,
      setTimeout(() => {
        this.undoTimers.delete(id);
        this.discardDeleted(deleted);
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
    this.discardDeleted(deleted);
    return restored;
  }

  /** Drops the decrypted copies once undo is no longer possible. */
  private discardDeleted(deleted: DeletedDocument): void {
    for (const file of deleted.files) this.discardTemp(this.toPath(file.uri), '');
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

  /**
   * Wipes every document, the index, and the vault's entries. The device key
   * itself stays so the next setup can reuse it.
   */
  async eraseEverything(): Promise<void> {
    for (const timer of this.undoTimers.values()) clearTimeout(timer);
    this.undoTimers.clear();
    await deleteDocumentStore(async () => {
      for (const key of await ExpoVaultModule.getAllKeys()) {
        await ExpoVaultModule.delete(key).catch(() => {});
        await ExpoVaultModule.deleteFile(key).catch(() => {});
      }
    });
    await this.clearCache();
    this.notify();
  }

  /** Remove every decrypted file from the cache directory, and every image the image library cached. */
  async clearCache(): Promise<void> {
    // The disk sweep also removes copies an older build wrote to the image
    // library's disk cache (iOS kept full decrypted pages there).
    const images = Promise.all([
      Image.clearMemoryCache().catch(() => false),
      Image.clearDiskCache().catch(() => false),
    ]);
    try {
      for (const entry of new Directory(this.cacheUri).list()) {
        const { name } = entry;
        if (
          name.startsWith('decrypted_') ||
          name.startsWith('thumb_') ||
          name.startsWith('temp_') ||
          name.startsWith('pages_') ||
          name.startsWith('undo_') ||
          name === 'share' ||
          name === IMAGE_PICKER_DIRECTORY ||
          name === SCANNER_DIRECTORY ||
          // BackupService's export staging: a killed export can leave one entry here.
          name === 'backup-staging'
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
    this.sweepScanPages();
    await images;
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

/** File-system safe name for a shared copy, e.g. "Passport (2026)" stays readable. */
export function shareFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'document';
}

export const documentService = new DocumentService();
export default documentService;
