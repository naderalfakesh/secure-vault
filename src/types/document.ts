export enum DocumentCategory {
  ID = 'id',
  MEDICAL = 'medical',
  FINANCE = 'finance',
  LEGAL = 'legal',
  INSURANCE = 'insurance',
  RECEIPTS = 'receipts',
  OTHER = 'other',
}

export const DocumentCategoryLabels: Record<DocumentCategory, string> = {
  [DocumentCategory.ID]: 'ID & Personal',
  [DocumentCategory.MEDICAL]: 'Medical',
  [DocumentCategory.FINANCE]: 'Finance',
  [DocumentCategory.LEGAL]: 'Legal',
  [DocumentCategory.INSURANCE]: 'Insurance',
  [DocumentCategory.RECEIPTS]: 'Receipts',
  [DocumentCategory.OTHER]: 'Other',
};

export type FileType = 'image' | 'pdf';

export interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  tags: string[];
  ocrText?: string;
  thumbnailKey: string;
  fileKey: string;
  fileType: FileType;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  documents: Record<string, Document>;
  version: number;
}

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}
