import type { ProcessingStep } from '@/features/scan/ProcessingPanel';
import type { SourceProblem } from '@/features/scan/SourceList';

import type { Origin, Phase } from './types';

export type FlowState = {
  phase: Phase;
  origin: Origin;
  problem: SourceProblem | null;
  step: ProcessingStep;
  saveError: string | null;
  savedId: string | null;
};

export const initialFlowState: FlowState = {
  phase: 'sources',
  origin: 'single',
  problem: null,
  step: 'ocr',
  saveError: null,
  savedId: null,
};

export type FlowAction =
  | { type: 'pagesScanned' }
  | { type: 'singlePicked' }
  | { type: 'sourceFailed'; problem: SourceProblem }
  | { type: 'readingStarted' }
  | { type: 'readingAdvanced'; step: ProcessingStep }
  | { type: 'detailsReady' }
  | { type: 'saveStarted' }
  | { type: 'saveAdvanced'; step: ProcessingStep }
  | { type: 'saved'; id: string }
  | { type: 'saveFailed'; message: string }
  | { type: 'saveReset' }
  | { type: 'returnedToSources' }
  | { type: 'returnedToReview' }
  | { type: 'returnedToDetails' };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'pagesScanned':
      return { ...state, problem: null, origin: 'scan', phase: 'review' };
    case 'singlePicked':
      return { ...state, problem: null, origin: 'single' };
    case 'sourceFailed':
      return { ...state, problem: action.problem };
    case 'readingStarted':
      return { ...state, step: 'ocr', phase: 'reading' };
    case 'readingAdvanced':
      return { ...state, step: action.step };
    case 'detailsReady':
      return { ...state, phase: 'details' };
    case 'saveStarted':
      return { ...state, saveError: null, step: 'encrypt', phase: 'saving' };
    case 'saveAdvanced':
      return { ...state, step: action.step };
    case 'saved':
      return { ...state, savedId: action.id };
    case 'saveFailed':
      return { ...state, saveError: action.message };
    case 'saveReset':
      return { ...state, saveError: null, savedId: null };
    case 'returnedToSources':
      return { ...state, phase: 'sources' };
    case 'returnedToReview':
      return { ...state, phase: 'review' };
    case 'returnedToDetails':
      return { ...state, phase: 'details' };
  }
}
