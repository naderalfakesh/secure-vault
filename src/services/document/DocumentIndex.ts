import { allowDocumentStore, openDocumentStore } from '@/data/database';
import type {
  DocumentOrder,
  DocumentRepository,
  ExtractedField,
  SearchHit,
} from '@/data/DocumentRepository';
import type { Document, DocumentCategory } from '@/types';

import { expiryCutoff } from './helpers';
import type { ChangeListener } from './types';

/**
 * The index side of the document service: opening the encrypted SQLite
 * index, the reads and metadata writes screens make through it, and the
 * change events every mounted list listens to.
 */
export class DocumentIndex {
  private listeners = new Set<ChangeListener>();

  protected async repository(): Promise<DocumentRepository> {
    return (await openDocumentStore()).repository;
  }

  /** Opens the index; safe to call repeatedly. */
  async initialize(): Promise<void> {
    await openDocumentStore();
  }

  /** After "Delete everything" the index stays closed; setup reopens it for the new vault. */
  allowIndex(): void {
    allowDocumentStore();
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
   * running a statement on the connection it already holds. Lists refresh
   * even when the new index fails to open, so none keeps showing rows from
   * the index that was replaced; they show the load failure instead.
   */
  async reload(): Promise<void> {
    try {
      await openDocumentStore();
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

  /** Every document in the index's order: newest or oldest added, or soonest expiry. */
  async listDocuments(order: DocumentOrder): Promise<Document[]> {
    return (await this.repository()).list(order);
  }

  /** Search results with the index's own highlighted snippet of the page text. */
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

  /** Documents whose extracted expiry date falls within `days` from today, soonest first. */
  async getExpiring(days: number): Promise<{ document: Document; date: string }[]> {
    const before = expiryCutoff(days, Date.now());
    return (await this.repository()).expiring('expires', before);
  }

  async getFields(id: string): Promise<ExtractedField[]> {
    return (await this.repository()).getFields(id);
  }
}
