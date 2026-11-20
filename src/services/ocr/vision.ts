import { recognizeText } from '../../../modules/expo-document-ai';
import { groupLines } from './blocks';
import type { OcrBlock } from './types';

/**
 * iOS: Apple Vision text recognition in the document AI module (ADR 0011).
 * Vision answers line by line; the lines are grouped into blocks so both
 * platforms hand the suggestion engines text in the same shape.
 */
export async function readWithVision(uri: string): Promise<OcrBlock[]> {
  const { lines } = await recognizeText(uri);
  return groupLines(lines);
}
