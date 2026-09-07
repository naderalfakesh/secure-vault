import type { ExtractedField } from '@/data/DocumentRepository';
import type { DocumentCategory } from '@/types';

export interface DocumentSuggestion {
  title?: string;
  category?: DocumentCategory;
  tags: string[];
  fields: ExtractedField[];
  /** Which engine produced the suggestion; shown honestly in Settings. */
  engine: IntelligenceEngine;
}

export type IntelligenceEngine = 'apple-foundation-models' | 'gemini-nano' | 'heuristic';

export interface DocumentIntelligence {
  readonly engine: IntelligenceEngine;
  isAvailable(): Promise<boolean>;
  /** Never throws: a failing engine returns an empty suggestion. */
  suggest(ocrText: string): Promise<DocumentSuggestion>;
}

export const EXPIRY_FIELD = 'expires';
