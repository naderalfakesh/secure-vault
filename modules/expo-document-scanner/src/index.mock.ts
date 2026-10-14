import type { ScannedPage, ScanOptions } from './index';

let queued: ScannedPage[] = [];
let scannerSupported = true;
let cameraAvailable = true;

/** Jest double: `queueScan` decides what the next scan returns. */
export function queueScan(pages: ScannedPage[]) {
  queued = pages;
}

/** Jest double: decide whether the platform scanner exists on this "device". */
export function setScannerSupported(supported: boolean) {
  scannerSupported = supported;
}

/** Jest double: decide whether a camera exists on this "device". */
export function setCameraAvailable(available: boolean) {
  cameraAvailable = available;
}

export function isScannerSupported(): boolean {
  return scannerSupported;
}

export function isCameraAvailable(): boolean {
  return cameraAvailable;
}

export async function scanDocuments(_options: ScanOptions = {}): Promise<ScannedPage[]> {
  const pages = queued;
  queued = [];
  return pages;
}
