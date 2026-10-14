import { requireOptionalNativeModule } from 'expo';
import * as Device from 'expo-device';
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
  /** Missing in native builds that predate the camera probe. */
  isCameraAvailable?(): boolean;
  scanDocuments(options: ScanOptions): Promise<ScannedPage[]>;
}

// Optional so a build that predates the module still runs; the add flow then hides the scanner.
function loadNative(): NativeScanner | null {
  if (Platform.OS === 'web') return null;
  try {
    return requireOptionalNativeModule<NativeScanner>('ExpoDocumentScanner');
  } catch {
    return null;
  }
}

const native = loadNative();

/** True when the platform scanner (VisionKit or ML Kit Document Scanner) can run here. */
export function isScannerSupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/**
 * True when this device can take a photo: UIImagePickerController's own source
 * check on iOS, the FEATURE_CAMERA_ANY system feature on Android. Opening the
 * camera picker without a camera throws an exception JavaScript cannot catch,
 * so the add flow asks this before offering the camera.
 */
export function isCameraAvailable(): boolean {
  if (!native) return false;
  try {
    // A native build older than the probe cannot answer; the simulator is the
    // only camera-less device the app runs on, so expo-device decides there.
    if (typeof native.isCameraAvailable !== 'function') return Device.isDevice;
    return native.isCameraAvailable();
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
