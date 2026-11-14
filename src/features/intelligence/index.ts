import { downloadModel, modelInfo } from '../../../modules/expo-document-ai';
import { heuristicIntelligence } from './heuristic';
import { onDeviceModelIntelligence } from './onDeviceModel';
import type { DocumentIntelligence, DocumentSuggestion } from './types';

export type { DocumentIntelligence, DocumentSuggestion, IntelligenceEngine } from './types';
export { EXPIRY_FIELD } from './types';
export type { ModelInfo } from '../../../modules/expo-document-ai';

/** The platform's on-device model and whether it is ready, for Settings. */
export const onDeviceModelInfo = modelInfo;

/**
 * Downloads the on-device model when the owner asks (Gemini Nano through
 * AICore), then lets the next suggestion pick it.
 */
export async function downloadOnDeviceModel(): Promise<void> {
  await downloadModel();
  selected = null;
}

/**
 * Engines in order of preference: the platform's on-device language model
 * where it is ready (Apple Foundation Models on iOS 26+, Gemini Nano on
 * supported Android), then the heuristic engine, which runs everywhere. Every
 * entry degrades to the heuristic engine, so the app is complete without a model.
 */
const candidates: DocumentIntelligence[] = [onDeviceModelIntelligence, heuristicIntelligence];

let selected: Promise<DocumentIntelligence> | null = null;

/** Picks the best available engine once per launch. */
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

/** Tests only: forget the engine picked for this launch. */
export function resetIntelligenceSelection() {
  selected = null;
}

/** Suggests metadata for extracted text; safe to call with anything. */
export async function suggestForText(ocrText: string): Promise<DocumentSuggestion> {
  const engine = await selectIntelligence();
  try {
    return await engine.suggest(ocrText);
  } catch {
    return heuristicIntelligence.suggest(ocrText);
  }
}
