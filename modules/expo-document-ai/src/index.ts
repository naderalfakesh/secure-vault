import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type ModelEngine = 'apple-foundation-models' | 'gemini-nano';

export type ModelStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface ModelInfo {
  engine: ModelEngine;
  status: ModelStatus;
  reason?: string | null;
}

/** Pixel coordinates in upright image space, origin top-left. */
export interface RecognizedLine {
  text: string;
  frame: { left: number; top: number; width: number; height: number };
}

export interface RecognizedText {
  width: number;
  height: number;
  lines: RecognizedLine[];
}

interface NativeDocumentAi {
  modelInfo(): Promise<ModelInfo>;
  extractDetails(instructions: string, text: string): Promise<string>;
  downloadModel(): Promise<void>;
  recognizeText?(path: string): Promise<RecognizedText>;
}

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

export async function modelInfo(): Promise<ModelInfo> {
  if (!native) return { engine: platformEngine, status: 'unavailable', reason: 'no-module' };
  try {
    return await native.modelInfo();
  } catch {
    return { engine: platformEngine, status: 'unavailable', reason: 'status-failed' };
  }
}

export function extractDetails(instructions: string, text: string): Promise<string> {
  if (!native) return Promise.reject(new Error('The on-device model is not available.'));
  return native.extractDetails(instructions, text);
}

export function downloadModel(): Promise<void> {
  if (!native) return Promise.reject(new Error('The on-device model is not available.'));
  return native.downloadModel();
}

export function recognizeText(path: string): Promise<RecognizedText> {
  if (Platform.OS !== 'ios' || !native?.recognizeText) {
    return Promise.reject(new Error('Apple Vision text recognition is not available.'));
  }
  return native.recognizeText(path);
}
