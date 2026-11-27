import TextRecognition from '@react-native-ml-kit/text-recognition';

import type { OcrBlock } from './types';

export async function readWithMlKit(uri: string): Promise<OcrBlock[]> {
  const result = await TextRecognition.recognize(uri);
  return result.blocks.map((block) => ({
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
}
