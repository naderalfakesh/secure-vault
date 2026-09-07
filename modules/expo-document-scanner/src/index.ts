import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface ScannedPage {
  /** File or content URI of a perspective-corrected JPEG page. Temporary; copy it into the vault. */
  uri: string;
  width: number;
  height: number;
}

export interface ScanOptions {
  /** JPEG quality, 0 to 1. */
  quality?: number;
  maxPages?: number;
}

interface NativeScanner {
  isSupported(): boolean;
  scanDocuments(options: ScanOptions): Promise<ScannedPage[]>;
}

const native =
  Platform.OS === 'web' ? null : requireNativeModule<NativeScanner>('ExpoDocumentScanner');

/** True when the platform scanner (VisionKit or ML Kit Document Scanner) can run here. */
export function isScannerSupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/**
 * Presents the platform document scanner and resolves with the captured pages,
 * or an empty array when the user cancels.
 */
export function scanDocuments(options: ScanOptions = {}): Promise<ScannedPage[]> {
  if (!native) return Promise.resolve([]);
  return native.scanDocuments({ quality: 0.85, maxPages: 20, ...options });
}
