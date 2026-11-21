import { type Dispatch, type RefObject, useCallback, useEffect, useRef } from 'react';

import { suggestForText } from '@/features/intelligence';
import { ocrService } from '@/services/OcrService';

import type { DetailsAction } from '../detailsReducer';
import type { FlowAction } from '../flowReducer';

type ReadPagesOptions = {
  mountedRef: RefObject<boolean>;
  dispatchDetails: Dispatch<DetailsAction>;
  dispatch: Dispatch<FlowAction>;
  /** Empties the form (and any earlier save) before a read fills it. */
  clearDetails: (suggestedTitle?: string) => void;
};

/**
 * Reads the text of the first page and suggests details, so the user
 * corrects instead of types. Both steps are best effort and cancellable.
 */
export function useReadPages({
  mountedRef,
  dispatchDetails,
  dispatch,
  clearDetails,
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
      dispatch({ type: 'readingStarted' });
      try {
        const result = await ocrService.extractText(previewUri);
        if (!current()) return;
        const text =
          result.text && ocrService.isTextMeaningful(result.text)
            ? ocrService.cleanText(result.text)
            : undefined;
        dispatchDetails({ type: 'read', ocrText: text });
        if (text) {
          dispatch({ type: 'readingAdvanced', step: 'suggest' });
          const suggestion = await suggestForText(text);
          if (!current()) return;
          dispatchDetails({ type: 'suggest', suggestion });
        }
      } catch {
        // The form still works without suggestions.
      }
      if (current()) dispatch({ type: 'detailsReady' });
    },
    [mountedRef, dispatchDetails, dispatch, clearDetails],
  );

  return { read, cancelRead };
}
