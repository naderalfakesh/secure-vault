import type { ScannedPage, ScanOptions } from './index';

let queued: ScannedPage[] = [];

/** Jest double: `queueScan` decides what the next scan returns. */
export function queueScan(pages: ScannedPage[]) {
  queued = pages;
}

export function isScannerSupported(): boolean {
  return true;
}

export async function scanDocuments(_options: ScanOptions = {}): Promise<ScannedPage[]> {
  const pages = queued;
  queued = [];
  return pages;
}
