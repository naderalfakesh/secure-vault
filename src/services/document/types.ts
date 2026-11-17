import type { DocumentRepository, ExtractedField } from '@/data/DocumentRepository';
import type { Document, PickedFile } from '@/types';

export type ChangeListener = () => void;

/** Everything needed to put a deleted document back, kept until the undo window closes. */
export interface DeletedDocument {
  document: Document;
  fields: ExtractedField[];
  /** Decrypted copies in the cache: main file first, then extra pages. */
  files: PickedFile[];
}

/** A decrypted copy for the share sheet. */
export type ShareCopy = {
  uri: string;
  /**
   * Deletes the copy after `ms` even while the app is away (Android's chooser
   * pauses JavaScript timers); `discard` cancels it.
   */
  expireAfter: (ms: number) => void;
  discard: () => void;
};

/** Opens the index on demand; each call may reopen it after a restore. */
export type RepositorySource = () => Promise<DocumentRepository>;

/**
 * The service's own lookups. The file modules call back through these, so a
 * test's spy on the singleton reaches every caller, as it did on the class.
 */
export interface DocumentLookup {
  getDocument(id: string): Promise<Document | null>;
  getDocumentFile(id: string): Promise<string | null>;
  getFields(id: string): Promise<ExtractedField[]>;
}
