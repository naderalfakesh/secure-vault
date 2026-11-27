import type { ScannedPage, ScanOptions } from './index';

let queued: ScannedPage[] = [];
let scannerSupported = true;
let cameraAvailable = true;

export function queueScan(pages: ScannedPage[]) {
  queued = pages;
}

export function setScannerSupported(supported: boolean) {
  scannerSupported = supported;
}

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
