import { recognizeText } from '@modules/expo-document-ai';

import { groupLines } from './blocks';
import type { OcrBlock } from './types';

export async function readWithVision(uri: string): Promise<OcrBlock[]> {
  const { lines } = await recognizeText(uri);
  return groupLines(lines);
}
