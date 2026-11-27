import { downloadModel, modelInfo } from '@modules/expo-document-ai';

import { heuristicIntelligence } from './heuristic';
import { onDeviceModelIntelligence } from './onDeviceModel';
import type { DocumentIntelligence, DocumentSuggestion } from './types';

export type { DocumentSuggestion } from './types';
export type { ModelInfo } from '@modules/expo-document-ai';

export const onDeviceModelInfo = modelInfo;

let selected: Promise<DocumentIntelligence> | null = null;

export async function downloadOnDeviceModel(): Promise<void> {
  await downloadModel();
  selected = null;
}

const candidates: DocumentIntelligence[] = [onDeviceModelIntelligence, heuristicIntelligence];

export function selectIntelligence(): Promise<DocumentIntelligence> {
  if (!selected) {
    selected = (async () => {
      for (const candidate of candidates) {
        if (await candidate.isAvailable().catch(() => false)) return candidate;
      }
      return heuristicIntelligence;
    })();
  }
  return selected;
}

export function resetIntelligenceSelection() {
  selected = null;
}

export async function suggestForText(ocrText: string): Promise<DocumentSuggestion> {
  const engine = await selectIntelligence();
  try {
    return await engine.suggest(ocrText);
  } catch {
    return heuristicIntelligence.suggest(ocrText);
  }
}
