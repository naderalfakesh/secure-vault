import { documentDatabase } from '@/data/database';
import type {
  DocumentOrder,
  DocumentRepository,
  ExtractedField,
  SearchHit,
} from '@/data/DocumentRepository';
import { FIELD_KEYS } from '@/types';
import type { Document, DocumentCategory } from '@/types';

import { expiryCutoff } from './helpers';
import type { ChangeListener } from './types';

export class DocumentIndex {
  private listeners = new Set<ChangeListener>();

  protected async repository(): Promise<DocumentRepository> {
    return (await documentDatabase.open()).repository;
  }

  async initialize(): Promise<void> {
    await documentDatabase.open();
  }

  allowIndex(): void {
    documentDatabase.allow();
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify even on open failure so mounted lists clear stale rows from the replaced index.
  async reload(): Promise<void> {
    try {
      await documentDatabase.open();
    } finally {
      this.notify();
    }
  }

  protected notify() {
    for (const listener of this.listeners) listener();
  }

  async getDocument(id: string): Promise<Document | null> {
    return (await this.repository()).get(id);
  }

  async getAllDocuments(): Promise<Document[]> {
    return (await this.repository()).list();
  }

  async countByCategory(): Promise<Partial<Record<DocumentCategory, number>>> {
    return (await this.repository()).countByCategory();
  }

  async listDocuments(order: DocumentOrder): Promise<Document[]> {
    return (await this.repository()).list(order);
  }

  async searchWithSnippets(query: string, order: DocumentOrder): Promise<SearchHit[]> {
    return (await this.repository()).searchWithSnippets(query, order);
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

  async getExpiring(days: number): Promise<{ document: Document; date: string }[]> {
    const before = expiryCutoff(days, Date.now());
    return (await this.repository()).expiring(FIELD_KEYS.expires, before);
  }

  async getFields(id: string): Promise<ExtractedField[]> {
    return (await this.repository()).getFields(id);
  }
}
