import type { PickedFile } from '@/types';

import type { Origin } from './types';

/** The file name a scanned page gets, numbered from 1. */
export function scanPageName(index: number, now: number = Date.now()): string {
  return `scan-${now}-${index + 1}.jpg`;
}

/** A photo keeps its own file name; a camera photo without one gets a scan name. */
export function photoName(fileName: string | null | undefined, now: number = Date.now()): string {
  return fileName ?? `scan-${now}.jpg`;
}

/** Comma-separated tags as a list, blanks dropped. */
export function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** A scan shows its pages; a photo or file its preview, when there is one. */
export function thumbnailsFor(
  origin: Origin,
  files: readonly PickedFile[],
  preview: string | null,
): string[] {
  if (origin === 'scan') return files.map((page) => page.uri);
  return preview ? [preview] : [];
}

/** The pages without the one at `index`. */
export function withoutPage(files: readonly PickedFile[], index: number): PickedFile[] {
  return files.filter((_, at) => at !== index);
}
