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

/** Jest double: the model this "device" reports. Unavailable by default. */
export function setModelInfo(next: ModelInfo) {
  info = next;
}

/** Jest double: what the model answers, as raw text or a rejection. */
export function setModelAnswer(next: string | Error | ((text: string) => Promise<string>)) {
  answer = (_instructions, text) =>
    typeof next === 'function'
      ? next(text)
      : next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
}

/** Jest double: every request the model received. */
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

/** Jest double: what a download does (resolves by default). */
export function setDownload(next: () => Promise<void>) {
  download = next;
}

/** Jest double: how many downloads were started. */
export function downloadCount() {
  return downloads;
}

export function downloadModel(): Promise<void> {
  downloads += 1;
  return download();
}

/** Jest double: what Apple Vision reads (nothing by default), or a failure. */
export function setRecognizedText(next: RecognizedText | Error) {
  reading = () => (next instanceof Error ? Promise.reject(next) : Promise.resolve(next));
}

/** Jest double: every path handed to Apple Vision. */
export function recognizedPaths() {
  return readPaths;
}

export function recognizeText(path: string): Promise<RecognizedText> {
  readPaths.push(path);
  return reading(path);
}
