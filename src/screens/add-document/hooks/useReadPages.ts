import { type Dispatch, type RefObject, useCallback, useEffect, useRef } from 'react';

import { suggestForText } from '@/features/intelligence';
import type { ProcessingStep } from '@/features/scan/ProcessingPanel';
import { ocrService } from '@/services/OcrService';

import type { DetailsAction } from '../detailsReducer';
import type { Phase } from '../types';

type ReadPagesOptions = {
  mountedRef: RefObject<boolean>;
  dispatch: Dispatch<DetailsAction>;
  /** Empties the form (and any earlier save) before a read fills it. */
  clearDetails: (suggestedTitle?: string) => void;
  setStep: (step: ProcessingStep) => void;
  setPhase: (phase: Phase) => void;
};

/**
 * Reads the text of the first page and suggests details, so the user
 * corrects instead of types. Both steps are best effort and cancellable.
 */
export function useReadPages({
  mountedRef,
  dispatch,
  clearDetails,
  setStep,
  setPhase,
}: ReadPagesOptions) {
  // Bumped whenever a read is cancelled or superseded; a late read result is dropped.
  const readRun = useRef(0);

  useEffect(
    () => () => {
      readRun.current += 1;
    },
    [],
  );

  const cancelRead = useCallback(() => {
    readRun.current += 1;
  }, []);

  const read = useCallback(
    async (previewUri: string, suggestedTitle: string) => {
      const run = (readRun.current += 1);
      const current = () => run === readRun.current && mountedRef.current;
      clearDetails(suggestedTitle);
      setStep('ocr');
      setPhase('reading');
      try {
        const result = await ocrService.extractText(previewUri);
        if (!current()) return;
        const text =
          result.text && ocrService.isTextMeaningful(result.text)
            ? ocrService.cleanText(result.text)
            : undefined;
        dispatch({ type: 'read', ocrText: text });
        if (text) {
          setStep('suggest');
          const suggestion = await suggestForText(text);
          if (!current()) return;
          dispatch({ type: 'suggest', suggestion });
        }
      } catch {
        // The form still works without suggestions.
      }
      if (current()) setPhase('details');
    },
    [mountedRef, dispatch, clearDetails, setStep, setPhase],
  );

  return { read, cancelRead };
}
