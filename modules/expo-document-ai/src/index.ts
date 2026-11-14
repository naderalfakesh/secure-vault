import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type ModelEngine = 'apple-foundation-models' | 'gemini-nano';

/** `available` is the only state the app uses; the others are shown in Settings. */
export type ModelStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface ModelInfo {
  engine: ModelEngine;
  status: ModelStatus;
  /** The platform's own reason when the model is not available, for diagnostics. */
  reason?: string | null;
}

interface NativeDocumentAi {
  modelInfo(): Promise<ModelInfo>;
  extractDetails(instructions: string, text: string): Promise<string>;
  downloadModel(): Promise<void>;
}

// Optional so a build without the module still runs with heuristic suggestions.
function loadNative(): NativeDocumentAi | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    return requireOptionalNativeModule<NativeDocumentAi>('ExpoDocumentAi');
  } catch {
    return null;
  }
}

const native = loadNative();

const platformEngine: ModelEngine =
  Platform.OS === 'ios' ? 'apple-foundation-models' : 'gemini-nano';

/** Which on-device model this platform has and whether it can answer now. */
export async function modelInfo(): Promise<ModelInfo> {
  if (!native) return { engine: platformEngine, status: 'unavailable', reason: 'no-module' };
  try {
    return await native.modelInfo();
  } catch {
    return { engine: platformEngine, status: 'unavailable', reason: 'status-failed' };
  }
}

/**
 * Asks the on-device model for a document's details. Resolves to the model's
 * answer as JSON text; rejects when no model is available or it fails. The
 * caller must check every value against the document text.
 */
export function extractDetails(instructions: string, text: string): Promise<string> {
  if (!native) return Promise.reject(new Error('The on-device model is not available.'));
  return native.extractDetails(instructions, text);
}

/**
 * Downloads the platform's model where the app may start it (Gemini Nano on
 * Android, through AICore). Only call it when `modelInfo()` reports
 * `downloadable` and the owner asked for it.
 */
export function downloadModel(): Promise<void> {
  if (!native) return Promise.reject(new Error('The on-device model is not available.'));
  return native.downloadModel();
}
