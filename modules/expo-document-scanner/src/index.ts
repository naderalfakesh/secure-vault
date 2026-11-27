import { requireOptionalNativeModule } from 'expo';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface ScannedPage {
  uri: string;
  width: number;
  height: number;
}

export interface ScanOptions {
  quality?: number;
  maxPages?: number;
}

interface NativeScanner {
  isSupported(): boolean;
  isCameraAvailable?(): boolean;
  scanDocuments(options: ScanOptions): Promise<ScannedPage[]>;
}

function loadNative(): NativeScanner | null {
  if (Platform.OS === 'web') return null;
  try {
    return requireOptionalNativeModule<NativeScanner>('ExpoDocumentScanner');
  } catch {
    return null;
  }
}

const native = loadNative();

export function isScannerSupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/** Probes camera hardware before opening picker (opening without hardware throws an uncatchable native exception). */
export function isCameraAvailable(): boolean {
  if (!native) return false;
  try {
    if (typeof native.isCameraAvailable !== 'function') return Device.isDevice;
    return native.isCameraAvailable();
  } catch {
    return false;
  }
}

export function scanDocuments(options: ScanOptions = {}): Promise<ScannedPage[]> {
  if (!native) return Promise.resolve([]);
  return native.scanDocuments({ quality: 0.85, maxPages: 20, ...options });
}
