import { Platform } from 'react-native';

import { errorCode } from '@/utils/errors';

import { readWithMlKit } from './mlKit';
import type { OcrResult, TextReader } from './types';
import { readWithVision } from './vision';

function platformReader(): TextReader {
  return Platform.OS === 'ios' ? readWithVision : readWithMlKit;
}

class OcrService {
  async extractText(imagePath: string): Promise<OcrResult> {
    try {
      const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;

      const blocks = await platformReader()(uri);

      const fullText = blocks.map((block) => block.text).join('\n\n');

      return {
        text: fullText.trim(),
        blocks,
      };
    } catch (error: unknown) {
      // Log only error code so file paths never reach console.
      console.warn('OCR extraction failed:', errorCode(error) ?? 'no error code');
      return {
        text: '',
        blocks: [],
      };
    }
  }

  isTextMeaningful(text: string): boolean {
    if (!text || text.length < 3) return false;

    // Count letters + combining marks (Arabic/Indic vowels) so numeric-only noise isn't indexed.
    const letters = text.replace(/[^\p{L}\p{M}]/gu, '').length;
    const ratio = letters / text.length;

    return ratio > 0.3;
  }

  cleanText(text: string): string {
    // Preserve line breaks for line-based title/field heuristics.
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
}

export const ocrService = new OcrService();
