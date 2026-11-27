import type { PickedFile } from '@/types';

export type Phase = 'sources' | 'review' | 'reading' | 'details' | 'saving';

export type Origin = 'scan' | 'single';

export type SinglePick = {
  file: PickedFile;
  previewUri: string;
  suggestedTitle: string;
};

export type SaveNotice = { message: string; tone: 'success' | 'danger' };
