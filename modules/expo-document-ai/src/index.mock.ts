import type { ModelInfo, RecognizedText } from './index';

export type { ModelEngine, ModelInfo, ModelStatus, RecognizedLine, RecognizedText } from './index';

const unavailable: ModelInfo = { engine: 'apple-foundation-models', status: 'unavailable' };

let info: ModelInfo = unavailable;
let answer: (instructions: string, text: string) => Promise<string> = () =>
  Promise.reject(new Error('The on-device model is not available.'));
let calls: { instructions: string; text: string }[] = [];
let download: () => Promise<void> = () => Promise.resolve();
let downloads = 0;

const nothingRead: RecognizedText = { width: 0, height: 0, lines: [] };
let reading: (path: string) => Promise<RecognizedText> = () => Promise.resolve(nothingRead);
let readPaths: string[] = [];

export function setModelInfo(next: ModelInfo) {
  info = next;
}

export function setModelAnswer(next: string | Error | ((text: string) => Promise<string>)) {
  answer = (_instructions, text) =>
    typeof next === 'function'
      ? next(text)
      : next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
}

export function modelCalls() {
  return calls;
}

export function resetModel() {
  info = unavailable;
  download = () => Promise.resolve();
  downloads = 0;
  answer = () => Promise.reject(new Error('The on-device model is not available.'));
  calls = [];
  reading = () => Promise.resolve(nothingRead);
  readPaths = [];
}

export async function modelInfo(): Promise<ModelInfo> {
  return info;
}

export function extractDetails(instructions: string, text: string): Promise<string> {
  calls.push({ instructions, text });
  return answer(instructions, text);
}

export function setDownload(next: () => Promise<void>) {
  download = next;
}

export function downloadCount() {
  return downloads;
}

export function downloadModel(): Promise<void> {
  downloads += 1;
  return download();
}

export function setRecognizedText(next: RecognizedText | Error) {
  reading = () => (next instanceof Error ? Promise.reject(next) : Promise.resolve(next));
}

export function recognizedPaths() {
  return readPaths;
}

export function recognizeText(path: string): Promise<RecognizedText> {
  readPaths.push(path);
  return reading(path);
}
