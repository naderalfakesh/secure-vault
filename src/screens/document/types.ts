import type { DocumentCategory } from '@/types';

type LoadFailureKind = 'missing' | 'unreadable';

export type LoadFailure = { kind: LoadFailureKind; detail?: string };

export type ViewerBusy = 'ocr' | 'delete' | 'share' | null;

export type Draft = { title: string; category: DocumentCategory; tags: string };
