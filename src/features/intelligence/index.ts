import { heuristicIntelligence } from './heuristic';
import type { DocumentIntelligence, DocumentSuggestion } from './types';

export type { DocumentIntelligence, DocumentSuggestion, IntelligenceEngine } from './types';
export { EXPIRY_FIELD } from './types';

/**
 * Engines in order of preference. On-device language models are added here
 * when their platform adapters land; every entry must degrade to the
 * heuristic engine so the app is complete without any of them.
 */
const candidates: DocumentIntelligence[] = [heuristicIntelligence];

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

/** Suggests metadata for extracted text; safe to call with anything. */
export async function suggestForText(ocrText: string): Promise<DocumentSuggestion> {
  const engine = await selectIntelligence();
  try {
    return await engine.suggest(ocrText);
  } catch {
    return heuristicIntelligence.suggest(ocrText);
  }
}
