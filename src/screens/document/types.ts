import type { DocumentCategory } from '@/types';

export type LoadFailureKind = 'missing' | 'unreadable';

export type LoadFailure = { kind: LoadFailureKind; detail?: string };

/** The action under way, if any; each one disables its own control. */
export type ViewerBusy = 'ocr' | 'delete' | 'share' | null;

/** The edit form's values, before they are trimmed and saved. */
export type Draft = { title: string; category: DocumentCategory; tags: string };
