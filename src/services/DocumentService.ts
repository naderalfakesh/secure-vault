import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import ExpoVaultModule from '../../modules/expo-vault';
import { Document, DocumentCategory, DocumentMetadata, PickedFile } from '../types';

const METADATA_KEY = '_documents_metadata';
const FILE_PREFIX = 'file_';
const THUMB_PREFIX = 'thumb_';

class DocumentService {
  private metadata: DocumentMetadata | null = null;
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

  /**
   * Initialize the service by loading metadata from vault
   */
  async initialize(): Promise<void> {
    try {
      const metadataJson = await ExpoVaultModule.get(METADATA_KEY);
      this.metadata = JSON.parse(metadataJson);
    } catch {
      // No metadata exists yet, create empty structure
      this.metadata = { documents: {}, version: 1 };
      await this.saveMetadata();
    }
  }

  /**
   * Save metadata to vault
   */
  private async saveMetadata(): Promise<void> {
    if (!this.metadata) return;
    await ExpoVaultModule.put(METADATA_KEY, JSON.stringify(this.metadata));
  }

  /**
   * Add a new document to the vault
   */
  async addDocument(
    file: PickedFile,
    metadata: Partial<Document>
  ): Promise<Document> {
    if (!this.metadata) await this.initialize();

    const id = Crypto.randomUUID();
    const fileKey = `${FILE_PREFIX}${id}`;
    const thumbnailKey = `${THUMB_PREFIX}${id}`;
    const now = new Date().toISOString();

    // Determine file type
    const fileType: 'image' | 'pdf' = file.type?.includes('pdf') ? 'pdf' : 'image';

    // Get the actual file path (handle content:// URIs on Android)
    const sourcePath = await this.getLocalFilePath(file.uri);

    // Store the encrypted file
    await ExpoVaultModule.putFile(fileKey, sourcePath);

    // Store thumbnail for images (reuse source for now)
    if (fileType === 'image') {
      try {
        await ExpoVaultModule.putFile(thumbnailKey, sourcePath);
      } catch (e) {
        console.warn('Failed to generate thumbnail:', e);
      }
    }

    // Clean up temp file if we copied it
    if (sourcePath !== this.toPath(file.uri) && this.isCachePath(sourcePath)) {
      try {
        const tempFile = new File(this.toUri(sourcePath));
        if (tempFile.exists) tempFile.delete();
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }
    }

    // Create document record
    const document: Document = {
      id,
      title: metadata.title || file.name || 'Untitled Document',
      category: metadata.category || DocumentCategory.OTHER,
      tags: metadata.tags || [],
      ocrText: metadata.ocrText,
      thumbnailKey,
      fileKey,
      fileType,
      fileSize: file.size || 0,
      createdAt: now,
      updatedAt: now,
    };

    // Save to metadata
    this.metadata!.documents[id] = document;
    await this.saveMetadata();

    return document;
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<Document | null> {
    if (!this.metadata) await this.initialize();
    return this.metadata!.documents[id] || null;
  }

  /**
   * Get all documents
   */
  async getAllDocuments(): Promise<Document[]> {
    if (!this.metadata) await this.initialize();
    return Object.values(this.metadata!.documents).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
    const all = await this.getAllDocuments();
    return all.filter((doc) => doc.category === category);
  }

  /**
   * Search documents by title, tags, or OCR text
   */
  async searchDocuments(query: string): Promise<Document[]> {
    const all = await this.getAllDocuments();
    const lowerQuery = query.toLowerCase();

    return all.filter((doc) => {
      const titleMatch = doc.title.toLowerCase().includes(lowerQuery);
      const tagMatch = doc.tags.some((tag) =>
        tag.toLowerCase().includes(lowerQuery)
      );
      const ocrMatch = doc.ocrText?.toLowerCase().includes(lowerQuery);
      return titleMatch || tagMatch || ocrMatch;
    });
  }

  /**
   * Update a document's metadata
   */
  async updateDocument(
    id: string,
    updates: Partial<Omit<Document, 'id' | 'fileKey' | 'thumbnailKey' | 'createdAt'>>
  ): Promise<Document | null> {
    if (!this.metadata) await this.initialize();

    const doc = this.metadata!.documents[id];
    if (!doc) return null;

    const updatedDoc: Document = {
      ...doc,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.metadata!.documents[id] = updatedDoc;
    await this.saveMetadata();

    return updatedDoc;
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    if (!this.metadata) await this.initialize();

    const doc = this.metadata!.documents[id];
    if (!doc) return false;

    // Delete encrypted files
    try {
      await ExpoVaultModule.deleteFile(doc.fileKey);
    } catch (e) {
      console.warn('Failed to delete file:', e);
    }

    try {
      await ExpoVaultModule.deleteFile(doc.thumbnailKey);
    } catch (e) {
      console.warn('Failed to delete thumbnail:', e);
    }

    // Remove from metadata
    delete this.metadata!.documents[id];
    await this.saveMetadata();

    return true;
  }

  /**
   * Get the decrypted file path for a document
   */
  async getDocumentFile(id: string): Promise<string | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const extension = doc.fileType === 'pdf' ? 'pdf' : 'jpg';
    const { uri, path } = this.getCacheLocation(`decrypted_${id}.${extension}`);

    await ExpoVaultModule.getFile(doc.fileKey, path);
    return uri;
  }

  /**
   * Get the decrypted thumbnail path for a document
   */
  async getDocumentThumbnail(id: string): Promise<string | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const { uri, path } = this.getCacheLocation(`thumb_${id}.jpg`);

    try {
      await ExpoVaultModule.getFile(doc.thumbnailKey, path);
      return uri;
    } catch {
      // Thumbnail might not exist for PDFs or if generation failed
      return null;
    }
  }

  /**
   * Clear all decrypted cache files
   */
  async clearCache(): Promise<void> {
    try {
      const entries = new Directory(this.cacheUri).list();
      for (const entry of entries) {
        const { name } = entry;
        if (name.startsWith('decrypted_') || name.startsWith('thumb_') || name.startsWith('temp_')) {
          try {
            entry.delete();
          } catch {
            // Ignore individual file deletion errors
          }
        }
      }
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }

  /**
   * Get local file path from URI (handles content:// URIs)
   */
  private async getLocalFilePath(uri: string): Promise<string> {
    // If it's already a file path, return as-is
    if (uri.startsWith('/') || uri.startsWith('file://')) {
      return this.toPath(uri);
    }

    // For content:// URIs, copy to a temp location using fetch
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

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    if (!this.metadata) await this.initialize();
    return Object.keys(this.metadata!.documents).length;
  }
}

// Export singleton instance
export const documentService = new DocumentService();
export default documentService;
