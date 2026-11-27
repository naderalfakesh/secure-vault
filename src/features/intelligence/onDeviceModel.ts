import { Platform } from 'react-native';

import { type ExtractedField, FIELD_KEYS } from '@/types';
import { extractDetails, type ModelEngine, modelInfo } from '@modules/expo-document-ai';

import { MAX_TEXT_LENGTH, MODEL_INSTRUCTIONS, MODEL_TIMEOUT_MS } from './constants';
import { heuristicIntelligence } from './heuristic';
import { checkModelAnswer, withTimeout } from './modelValidation';
import type { DocumentIntelligence, DocumentSuggestion } from './types';

export { MAX_TEXT_LENGTH, MODEL_INSTRUCTIONS, MODEL_TIMEOUT_MS } from './constants';
export { checkModelAnswer } from './modelValidation';

const engine: ModelEngine = Platform.OS === 'ios' ? 'apple-foundation-models' : 'gemini-nano';

export const onDeviceModelIntelligence: DocumentIntelligence = {
  engine,
  async isAvailable() {
    return (await modelInfo()).status === 'available';
  },
  async suggest(ocrText: string): Promise<DocumentSuggestion> {
    const text = ocrText.trim();
    if (!text) return { tags: [], fields: [], engine };
    const answer = await withTimeout(
      extractDetails(MODEL_INSTRUCTIONS, text.slice(0, MAX_TEXT_LENGTH)),
      MODEL_TIMEOUT_MS,
    );
    const model = checkModelAnswer(answer, text);
    const fallback = await heuristicIntelligence.suggest(text);
    const found = (key: string) => fallback.fields.find((field) => field.key === key)?.value;

    const fields: ExtractedField[] = [];
    const expires = model.expires ?? found(FIELD_KEYS.expires);
    const issued = model.issued ?? found(FIELD_KEYS.issued);
    const number = model.number ?? found(FIELD_KEYS.number);
    if (expires) fields.push({ key: FIELD_KEYS.expires, value: expires, kind: 'date' });
    if (issued && issued !== expires)
      fields.push({ key: FIELD_KEYS.issued, value: issued, kind: 'date' });
    if (number) fields.push({ key: FIELD_KEYS.number, value: number, kind: 'text' });

    const category = model.category ?? fallback.category;
    const tags = model.tags.length
      ? [...new Set([...(category ? [category] : []), ...model.tags])].slice(0, 3)
      : fallback.tags;

    return {
      title: model.title ?? fallback.title,
      category,
      tags,
      fields,
      engine,
    };
  },
};
