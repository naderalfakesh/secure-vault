import type { PickedFile } from '@/types';

/**
 * sources → (scan) review pages → reading → details → saving → Library.
 * A failed save stays on the saving step with Try again.
 */
export type Phase = 'sources' | 'review' | 'reading' | 'details' | 'saving';

/** Where the pages came from: a scan goes back to its pages, anything else to the sources. */
export type Origin = 'scan' | 'single';

/** A single photo or file, its preview, and the title it starts with. */
export type SinglePick = {
  file: PickedFile;
  previewUri: string;
  suggestedTitle: string;
};

/** A save outcome shown as a toast, or on the next unlock. */
export type SaveNotice = { message: string; tone: 'success' | 'danger' };
