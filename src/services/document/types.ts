import type { DocumentRepository, ExtractedField } from '@/data/DocumentRepository';
import type { Document, PickedFile } from '@/types';

export type ChangeListener = () => void;

export interface DeletedDocument {
  document: Document;
  fields: ExtractedField[];
  files: PickedFile[];
}

export type ShareCopy = {
  uri: string;
  // Native expiry timer survives Android share chooser pausing JS timers.
  expireAfter: (ms: number) => void;
  discard: () => void;
};

export type RepositorySource = () => Promise<DocumentRepository>;

export interface DocumentLookup {
  getDocument(id: string): Promise<Document | null>;
  getDocumentFile(id: string): Promise<string | null>;
  getFields(id: string): Promise<ExtractedField[]>;
}
