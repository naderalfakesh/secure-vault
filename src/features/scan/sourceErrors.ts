import { resolveErrorMessage } from '@/utils/errorMessages';
import { KEY_LOCKED_MESSAGE } from '@/utils/errors';
import { isKeyLocked } from '@modules/expo-vault';

import { scanText, type ScanCopyKey } from './scanCopy';
import type { Source } from './SourceList';

const scannerMessages: Record<string, ScanCopyKey> = {
  SCANNER_UNAVAILABLE: 'sources.scanUnavailable',
  SCAN_FAILED: 'sources.scanFailed',
  SCAN_IN_PROGRESS: 'sources.scanBusy',
  NO_ACTIVITY: 'sources.scanNotOpened',
};

/** The scanner's own codes, which only mean something for the scan source. */
function scannerSentences(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(scannerMessages).map(([code, key]) => [code, scanText(key)]),
  );
}

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
  return resolveErrorMessage(error, {
    fallback: scanText(sourceFallbacks[source]),
    codes: ['KEY_INVALIDATED'],
    overrides: source === 'scan' ? scannerSentences() : undefined,
    vetMessage: () => undefined,
  });
}
