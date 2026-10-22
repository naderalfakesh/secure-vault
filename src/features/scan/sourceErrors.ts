import { isKeyLocked } from '../../../modules/expo-vault/src/withKeyRecovery';
import { KEY_INVALIDATED_MESSAGE, KEY_LOCKED_MESSAGE } from '@/utils/errors';

import { scanText, type ScanCopyKey } from './scanCopy';
import type { Source } from './SourceList';

const scannerMessages: Record<string, ScanCopyKey> = {
  SCANNER_UNAVAILABLE: 'sources.scanUnavailable',
  SCAN_FAILED: 'sources.scanFailed',
  SCAN_IN_PROGRESS: 'sources.scanBusy',
  NO_ACTIVITY: 'sources.scanNotOpened',
};

const sourceFallbacks: Record<Source, ScanCopyKey> = {
  scan: 'sources.scanNotOpened',
  camera: 'sources.cameraFailed',
  library: 'sources.libraryFailed',
  files: 'sources.filesFailed',
};

/**
 * One plain sentence for a source on the Add sheet that failed. Native
 * rejections ("Call to function 'ExpoDocumentScanner.scanDocuments' has been
 * rejected. → Caused by: java.lang.NullPointerException") are diagnostics,
 * so their text is never shown: the scanner's own codes get their sentence,
 * the vault's key errors theirs, and anything else the source's fallback.
 */
export function sourceFailureMessage(source: Source, error: unknown): string {
  if (isKeyLocked(error)) return KEY_LOCKED_MESSAGE;
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  if (code === 'KEY_INVALIDATED') return KEY_INVALIDATED_MESSAGE;
  if (source === 'scan' && typeof code === 'string' && scannerMessages[code]) {
    return scanText(scannerMessages[code]);
  }
  return scanText(sourceFallbacks[source]);
}
