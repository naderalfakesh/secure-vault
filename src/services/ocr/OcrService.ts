import { Platform } from 'react-native';

import { readWithMlKit } from './mlKit';
import type { OcrResult, TextReader } from './types';
import { readWithVision } from './vision';

/** Apple Vision on iOS, Google ML Kit on Android (ADR 0011). */
function platformReader(): TextReader {
  return Platform.OS === 'ios' ? readWithVision : readWithMlKit;
}

class OcrService {
  /**
   * Extract text from an image file
   * @param imagePath - Path to the image file (can be file:// URI or absolute path)
   * @returns Extracted text and structured blocks
   */
  async extractText(imagePath: string): Promise<OcrResult> {
    try {
      // Ensure the path is properly formatted
      const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;

      const blocks = await platformReader()(uri);

      // Combine all text with proper spacing
      const fullText = blocks.map((block) => block.text).join('\n\n');

      return {
        text: fullText.trim(),
        blocks,
      };
    } catch (error: any) {
      console.warn('OCR extraction failed:', error?.message || 'Unknown OCR error');
      // Return empty result on failure - don't block document import
      return {
        text: '',
        blocks: [],
      };
    }
  }

  /**
   * Check if the extracted text appears to be meaningful
   * (not just noise or artifacts)
   */
  isTextMeaningful(text: string): boolean {
    if (!text || text.length < 3) return false;

    // Check if text has a reasonable ratio of letters to total characters
    const letters = text.replace(/[^a-zA-Z]/g, '').length;
    const ratio = letters / text.length;

    return ratio > 0.3; // At least 30% letters
  }

  /**
   * Clean up extracted text for better readability
   */
  cleanText(text: string): string {
    // Keep line breaks: the title and field heuristics read the text line by
    // line, and document numbers must survive untouched.
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
}

export const ocrService = new OcrService();
export default ocrService;
