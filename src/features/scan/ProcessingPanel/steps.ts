import type { ScanCopyKey } from '../scanCopy';
export const STEPS = ['ocr', 'suggest', 'encrypt', 'index'] as const;

export type ProcessingStep = (typeof STEPS)[number];

export const STEP_COPY: Record<ProcessingStep, ScanCopyKey> = {
  ocr: 'step.ocr',
  suggest: 'step.suggest',
  encrypt: 'step.encrypt',
  index: 'step.index',
};

/** Steps before this one can still be cancelled. */
export function isCancellable(step: ProcessingStep): boolean {
  return STEPS.indexOf(step) < STEPS.indexOf('encrypt');
}
