import type { PickedFile } from '@/types';

import type { Origin } from './types';

export function scanPageName(index: number, now: number = Date.now()): string {
  return `scan-${now}-${index + 1}.jpg`;
}

export function photoName(fileName: string | null | undefined, now: number = Date.now()): string {
  return fileName ?? `scan-${now}.jpg`;
}

export function thumbnailsFor(
  origin: Origin,
  files: readonly PickedFile[],
  preview: string | null,
): string[] {
  if (origin === 'scan') return files.map((page) => page.uri);
  return preview ? [preview] : [];
}

export function withoutPage(files: readonly PickedFile[], index: number): PickedFile[] {
  return files.filter((_, at) => at !== index);
}
