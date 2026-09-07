import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
}

export interface OcrBlock {
  text: string;
  lines: string[];
  boundingBox?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
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

      const result = await TextRecognition.recognize(uri);

      // Extract text from all blocks
      const blocks: OcrBlock[] = result.blocks.map((block) => ({
        text: block.text,
        lines: block.lines.map((line) => line.text),
        boundingBox: block.frame
          ? {
              left: block.frame.left,
              top: block.frame.top,
              right: block.frame.left + block.frame.width,
              bottom: block.frame.top + block.frame.height,
            }
          : undefined,
      }));

      // Combine all text with proper spacing
      const fullText = result.blocks.map((block) => block.text).join('\n\n');

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
    return (
      text
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Fix common OCR mistakes
        .replace(/\|/g, 'I')
        .replace(/0(?=[a-zA-Z])/g, 'O')
        .replace(/1(?=[a-zA-Z])/g, 'l')
        // Remove isolated single characters (noise)
        .replace(/\s[a-zA-Z]\s/g, ' ')
        // Normalize line breaks
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  }
}

export const ocrService = new OcrService();
export default ocrService;
