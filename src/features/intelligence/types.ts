import type { DocumentCategory, ExtractedField } from '@/types';

export interface DocumentSuggestion {
  title?: string;
  category?: DocumentCategory;
  tags: string[];
  fields: ExtractedField[];
  engine: IntelligenceEngine;
}

export type IntelligenceEngine = 'apple-foundation-models' | 'gemini-nano' | 'heuristic';

export interface DocumentIntelligence {
  readonly engine: IntelligenceEngine;
  isAvailable(): Promise<boolean>;
  suggest(ocrText: string): Promise<DocumentSuggestion>;
}
